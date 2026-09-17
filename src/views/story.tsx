"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useChartColors } from "@/components/providers";
import { AnimatedValue, cx } from "@/components/ui";
import { ColumnBars, PerTon, SignedBars } from "@/components/charts";
import { RankShift } from "@/components/visuals";
import { HELD, MERIDIAN, SHIPMENTS, isEnergy } from "@/lib/data";
import {
  buckets, byRoute, costPerTon, evaluateTriggers, money, pct, revPerTon, SCENARIOS, simulate, sum, totals,
} from "@/lib/analytics";

function Slide({ kicker, title, children, note }: { kicker: string; title: ReactNode; children?: ReactNode; note?: ReactNode }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center px-5 sm:px-10">
      <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-gold">{kicker}</p>
      <h1 className="mt-3 max-w-4xl font-serif text-[clamp(1.8rem,1.1rem+2.6vw,3.4rem)] font-bold leading-[1.08] tracking-tight text-ink">{title}</h1>
      {children && <div className="mt-8">{children}</div>}
      {note && <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-ink-2">{note}</p>}
    </div>
  );
}

function Big({ value, format, label, tone }: { value: number; format: (v: number) => string; label: string; tone: "loss" | "gain" | "warn" | "ink" }) {
  const cls = { loss: "text-loss", gain: "text-gain", warn: "text-gold", ink: "text-ink" }[tone];
  return (
    <div className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
      <p className={cx("tabular font-serif text-[clamp(2rem,1.4rem+2.4vw,3.6rem)] font-bold leading-none", cls)}>
        <AnimatedValue value={value} format={format} />
      </p>
      <p className="mt-2 text-[14px] text-ink-2">{label}</p>
    </div>
  );
}

export function StoryView() {
  const c = useChartColors();
  const [i, setI] = useState(0);
  const d = useMemo(() => {
    const t = totals(SHIPMENTS);
    const energy = SHIPMENTS.filter(isEnergy);
    const cont = SHIPMENTS.filter((s) => !isEnergy(s));
    const energyRoutes = byRoute(energy).filter((r) => r.key !== "Overland Truck" && r.key !== "Air Bridge");
    const b = buckets(SHIPMENTS);
    const held = SHIPMENTS.filter((s) => s.route === HELD);
    const heldCost = sum(held, (s) => s.cost);
    const triggers = evaluateTriggers();
    const plan = simulate(SHIPMENTS, SCENARIOS.find((s) => s.id === "plan")!.levers);
    const pb = energyRoutes.find((r) => r.key === "Pipeline Bypass")!;
    const dir = energyRoutes.find((r) => r.key === "Direct (Pre-Blockade)")!;
    return { t, energy, cont, energyRoutes, b, held, heldCost, triggers, plan, pb, dir };
  }, []);

  const merPb = d.b.find((x) => x.id === "mer-pb")!;
  const bins = [[0, 10, "< 10 days"], [10, 20, "10–19"], [20, 30, "20–29"], [30, 40, "30–39"], [40, 999, "40+ days"]] as const;

  const slides: ReactNode[] = [
    <Slide key="1" kicker="War Room Masterplan · Strait Outta Hormuz"
      title={<>The blockade turned <span className="text-sky">{money(d.t.rev)}</span> of revenue into a <span className="text-loss">{money(-d.t.margin, { sign: false })}</span> loss.</>}
      note="243 shipments, 5 January to 22 March 2026. The question isn’t what was disrupted — everything was. It’s where disruption became a business problem.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Big value={d.t.margin} format={(v) => money(v)} label="gross margin" tone="loss" />
        <Big value={d.t.cost / d.t.recog} format={(v) => `${v.toFixed(1)}×`} label="cost for every dollar of revenue earned" tone="warn" />
        <Big value={d.t.heldValue} format={(v) => money(v)} label="of cargo still stuck in the Gulf" tone="warn" />
      </div>
    </Slide>,

    <Slide key="2" kicker="1 · The mechanism" title="Revenue per ton never moved. Cost per ton did."
      note={<>Freight fees were agreed before the blockade and don&rsquo;t reprice by route. On Pipeline Bypass, energy cargo costs <b className="text-loss">{(costPerTon(d.pb.rows) / costPerTon(d.dir.rows)).toFixed(1)}×</b> the pre-blockade rate, against revenue of about ${revPerTon(d.pb.rows).toFixed(1)} a ton.</>}>
      <div className="rounded-2xl border border-line bg-panel">
        <PerTon height={300} data={d.energyRoutes.map((r) => ({ key: r.key === "Direct (Pre-Blockade)" ? "Direct (pre)" : r.key, cost: costPerTon(r.rows), rev: revPerTon(r.rows), n: r.n }))} />
      </div>
    </Slide>,

    <Slide key="3" kicker="2 · Where it landed" title="One P&L, two very different businesses."
      note="Containerized cargo is most of the activity, but almost none of the money. Energy cargo is the whole problem.">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-loss/40 bg-loss-soft p-6">
          <p className="font-mono text-[12px] font-semibold uppercase tracking-wider text-loss">Energy cargo · {d.energy.length} shipments</p>
          <p className="tabular mt-2 font-serif text-5xl font-bold text-loss"><AnimatedValue value={sum(d.energy, (s) => s.margin)} format={(v) => money(v)} /></p>
          <p className="mt-2 text-ink-2">{pct(sum(d.energy, (s) => s.margin) / d.t.margin, 1)} of the loss</p>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-6">
          <p className="font-mono text-[12px] font-semibold uppercase tracking-wider text-ink-3">Containerized · {d.cont.length} shipments</p>
          <p className="tabular mt-2 font-serif text-5xl font-bold text-ink"><AnimatedValue value={sum(d.cont, (s) => s.margin)} format={(v) => money(v)} /></p>
          <p className="mt-2 text-ink-2">{pct(sum(d.cont, (s) => s.margin) / d.t.margin, 1)} of the loss · Overland at 100% on time</p>
        </div>
      </div>
    </Slide>,

    <Slide key="4" kicker="3 · The concentration" title={<>Twelve shipments. One account. <span className="text-loss">{pct(merPb.margin / d.t.margin)}</span> of the loss.</>}
      note={<>{MERIDIAN} on Pipeline Bypass lost {money(merPb.margin)}. The fix is commercial — reprice the contract — not dropping an account that has been with us since 2014.</>}>
      <div className="rounded-2xl border border-line bg-panel">
        <SignedBars height={300} labelWidth={200}
          data={d.b.map((x) => ({ key: x.label, value: x.margin, n: x.n, color: x.id === "mer-pb" ? c.loss : x.tone === "gain" ? c.gain : x.id === "held" ? c.gold : c.slate }))} />
      </div>
    </Slide>,

    <Slide key="5" kicker="4 · The hidden cost" title="Waiting in the Gulf is a cash problem, not a routing one."
      note={<>{d.held.length} ships, {money(sum(d.held, (s) => s.value))} of cargo, $0 recognized. {pct(sum(d.held, (s) => s.ins + s.pen) / d.heldCost)} of the {money(d.heldCost)} already spent is insurance and penalties — the cost of waiting.</>}>
      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr]">
        <div className="grid gap-3">
          <Big value={sum(d.held, (s) => s.value)} format={(v) => money(v)} label="cargo value stuck" tone="warn" />
          <Big value={sum(d.held, (s) => s.ins + s.pen) / d.heldCost} format={(v) => pct(v)} label="of the cost is waiting, not moving" tone="loss" />
        </div>
        <div className="rounded-2xl border border-line bg-panel">
          <ColumnBars height={290} data={bins.map(([lo, hi, key]) => ({ key, value: d.held.filter((s) => s.delay >= lo && s.delay < hi).length, color: lo >= 30 ? c.loss : c.gold }))} />
        </div>
      </div>
    </Slide>,

    <Slide key="6" kicker="5 · The evidence check" title="The worst percentage isn’t the biggest problem."
      note="Ranked by margin %, High-Tech looks nearly as bad as crude oil. Ranked by dollars, it barely registers. We ranked by dollars.">
      <div className="rounded-2xl border border-line bg-panel p-4"><RankShift rows={SHIPMENTS} /></div>
    </Slide>,

    <Slide key="7" kicker="6 · The plan" title={<>Three levers win back <span className="text-gain">{money(d.plan.recovered, { sign: false })}</span>.</>}
      note={`Reroute non-Meridian Pipeline volume to Cape, pass 50% of Meridian's route premium through, and divert or claim any hold past 30 days. ${d.triggers.filter((x) => x.state === "firing").length} of our 6 triggers are firing in the data today.`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Big value={d.plan.reroute} format={(v) => money(v, { sign: "plus" })} label="reroute Pipeline → Cape" tone="gain" />
        <Big value={d.plan.passThrough} format={(v) => money(v, { sign: "plus" })} label="Meridian pass-through clause" tone="gain" />
        <Big value={d.plan.holds} format={(v) => money(v, { sign: "plus" })} label="30-day cap on Gulf holds" tone="gain" />
      </div>
    </Slide>,

    <Slide key="8" kicker="The answer" title="Protect what works. Change the contract. Stop the waiting.">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Protect", "Overland Truck for containerized cargo — it’s on time and nearly break-even.", "border-gain/50"],
          ["Change", "How energy freight is priced when the route changes, starting with Meridian.", "border-gold/60"],
          ["Stop", "Open-ended holds in the Gulf, and judging routes by margin %.", "border-loss/50"],
        ].map(([k, t, cl]) => (
          <div key={k} className={cx("rounded-2xl border-2 bg-panel p-6", cl)}>
            <p className="font-mono text-[12px] font-bold uppercase tracking-[0.2em] text-ink-3">{k}</p>
            <p className="mt-2 font-serif text-2xl font-bold leading-snug text-ink">{t}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/simulator" className="rounded-xl bg-gold px-4 py-2.5 text-[14px] font-semibold text-bg">Open the simulator</Link>
        <Link href="/" className="rounded-xl border border-line px-4 py-2.5 text-[14px] font-semibold text-ink">Explore the dashboard</Link>
      </div>
    </Slide>,
  ];

  const n = slides.length;
  const go = useCallback((k: number) => setI((x) => Math.max(0, Math.min(n - 1, x + k))), [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
          <X className="size-4" /> Exit story
        </Link>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Slides">
          {slides.map((_, k) => (
            <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)}
              className={cx("h-1.5 rounded-full transition-all", k === i ? "w-8 bg-gold" : "w-3 bg-line-2 hover:bg-ink-3")} />
          ))}
        </div>
        <button type="button" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()}
          className="hidden items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] font-medium text-ink-3 hover:text-ink sm:flex">
          <Expand className="size-4" /> Full screen
        </button>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto py-6">
        <AnimatePresence mode="wait">
          <motion.div key={i} className="h-full" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            {slides[i]}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} className="flex items-center gap-1.5 rounded-xl border border-line bg-panel px-4 py-2.5 text-[14px] font-medium text-ink disabled:opacity-30">
          <ChevronLeft className="size-4" /> Back
        </button>
        <span className="tabular text-[13px] text-ink-3">{i + 1} / {n} · use ← → keys</span>
        <button type="button" onClick={() => go(1)} disabled={i === n - 1} className="flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2.5 text-[14px] font-semibold text-bg disabled:opacity-30">
          Next <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
