"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Anchor, FileSignature, Info, RotateCcw, Shuffle } from "lucide-react";
import { useChartColors, useFilters } from "@/components/providers";
import { AnimatedValue, Card, CardHeader, PageHeader, Segmented, cx } from "@/components/ui";
import { DataTable } from "@/components/table";
import { CAPE_CPT, DIRECT_CPT, LEVERS_NONE, money, pct, SCENARIOS, simulate, type Levers } from "@/lib/analytics";

function Lever({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-panel-2 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold [&>svg]:size-[18px]">{icon}</span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{sub}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Range({ label, value, onChange, min, max, step, display }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; display: string }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[12.5px]">
        <span className="text-ink-2">{label}</span>
        <span className="tabular rounded-md bg-panel px-2 py-0.5 font-semibold text-ink">{display}</span>
      </span>
      <input
        type="range" className="range mt-2" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--fill" as string]: `${fill}%` }}
        aria-valuetext={display}
      />
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2.5 text-[12.5px] text-ink-2">
      <span className={cx("relative h-5 w-9 rounded-full transition", checked ? "bg-gold" : "bg-line-2")}>
        <span className={cx("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

export function SimulatorView() {
  const { rows, activeCount } = useFilters();
  const c = useChartColors();
  const [levers, setLevers] = useState<Levers>(SCENARIOS.find((s) => s.id === "plan")!.levers);
  const [scenario, setScenario] = useState("plan");
  const set = (patch: Partial<Levers>) => { setLevers((l) => ({ ...l, ...patch })); setScenario(""); };
  const r = useMemo(() => simulate(rows, levers), [rows, levers]);
  const loss = -r.baseline;
  const share = loss > 0 ? r.recovered / loss : 0;

  const steps = [
    { label: "Today", value: r.baseline, kind: "base" as const },
    { label: "Reroute Pipeline → Cape", value: r.reroute, kind: "gain" as const },
    { label: "Contract pass-through", value: r.passThrough, kind: "gain" as const },
    { label: "Cap Gulf holds", value: r.holds, kind: "gain" as const },
    { label: "After the plan", value: r.projected, kind: "end" as const },
  ];
  const lo = Math.min(r.baseline, 0), hi = Math.max(0, r.projected, r.baseline + r.recovered);
  const span = hi - lo || 1;
  const x = (v: number) => ((v - lo) / span) * 100;
  let run = r.baseline;

  const movers = r.byCustomer.filter((b) => b.after !== b.before).sort((a, b) => (b.after - b.before) - (a.after - a.before));

  return (
    <>
      <PageHeader
        eyebrow="What-if simulator"
        title="How much of the loss can we win back?"
        lede="Three levers from our plan, applied shipment by shipment to the real data. Pick a scenario or move the sliders; everything recalculates instantly."
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { setLevers(s.levers); setScenario(s.id); }}
            aria-pressed={scenario === s.id}
            className={cx(
              "rounded-2xl border p-4 text-left transition",
              scenario === s.id ? "border-gold bg-gold-soft" : "border-line bg-panel hover:border-line-2",
            )}
          >
            <p className={cx("text-[14px] font-semibold", scenario === s.id ? "text-gold" : "text-ink")}>{s.name}</p>
            <p className="mt-1 text-[12px] leading-snug text-ink-3">{s.blurb}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[15px] font-semibold text-ink">Levers</p>
            <button type="button" onClick={() => { setLevers(LEVERS_NONE); setScenario("none"); }} className="flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink">
              <RotateCcw className="size-3.5" /> Reset
            </button>
          </div>
          <div className="space-y-3">
            <Lever icon={<Shuffle />} title="1 · Reroute Pipeline Bypass to Cape" sub={`Re-price moved energy cargo at the Cape average: $${CAPE_CPT["Crude Oil"].toFixed(1)}/t crude, $${CAPE_CPT["Refined Petrochemicals"].toFixed(1)}/t refined.`}>
              <Range label="Share of eligible volume moved" value={levers.reroute} min={0} max={1} step={0.05} onChange={(v) => set({ reroute: v })} display={pct(levers.reroute)} />
              <Toggle checked={levers.rerouteMeridian} onChange={(v) => set({ rerouteMeridian: v })} label="Include Meridian (otherwise handled by repricing)" />
            </Lever>
            <Lever icon={<FileSignature />} title="2 · Mode-switch pass-through clause" sub={`Customer pays a share of the cost above the pre-blockade rate ($${DIRECT_CPT["Crude Oil"].toFixed(1)}/t crude) on rerouted shipments.`}>
              <Range label="Share of the premium passed through" value={levers.passThrough} min={0} max={1} step={0.05} onChange={(v) => set({ passThrough: v })} display={pct(levers.passThrough)} />
              <Segmented label="Applies to" value={levers.passScope} onChange={(v) => set({ passScope: v })} options={[{ value: "meridian", label: "Meridian only" }, { value: "energy", label: "All energy accounts" }]} />
            </Lever>
            <Lever icon={<Anchor />} title="3 · Cap how long we wait in the Gulf" sub="Divert or file the claim after the cap. Assumes insurance and penalties build up evenly over each day held.">
              <Range
                label="Divert or claim after"
                value={levers.holdCap ?? 50}
                min={10} max={50} step={1}
                onChange={(v) => set({ holdCap: v >= 50 ? null : v })}
                display={levers.holdCap === null ? "Keep waiting" : `${levers.holdCap} days`}
              />
            </Lever>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="p-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <p className="text-[12px] font-medium text-ink-3">Gross margin today</p>
                <p className="tabular mt-1 font-serif text-3xl font-bold text-loss"><AnimatedValue value={r.baseline} format={(v) => money(v)} /></p>
              </div>
              <div>
                <p className="text-[12px] font-medium text-ink-3">Recovered</p>
                <p className="tabular mt-1 font-serif text-3xl font-bold text-gain"><AnimatedValue value={r.recovered} format={(v) => money(v, { sign: "plus" })} /></p>
                <p className="text-[12px] text-ink-2"><AnimatedValue value={share} format={(v) => pct(v)} /> of the loss</p>
              </div>
              <div>
                <p className="text-[12px] font-medium text-ink-3">After the plan</p>
                <p className={cx("tabular mt-1 font-serif text-3xl font-bold", r.projected < 0 ? "text-loss" : "text-gain")}><AnimatedValue value={r.projected} format={(v) => money(v, { sign: "plus" })} /></p>
              </div>
            </div>

            <div className="mt-5">
              <div className="h-3 overflow-hidden rounded-full bg-loss-soft">
                <motion.div className="h-full rounded-full bg-gain" animate={{ width: `${Math.min(100, share * 100)}%` }} transition={{ type: "spring", damping: 26, stiffness: 180 }} />
              </div>
              <p className="mt-1.5 text-[11.5px] text-ink-3">Share of today&rsquo;s loss won back{activeCount ? " (current filter)" : ""}</p>
            </div>

            <div className="mt-6 space-y-2.5" role="img" aria-label={`Bridge from ${money(r.baseline)} to ${money(r.projected)}: reroute ${money(r.reroute)}, pass-through ${money(r.passThrough)}, hold cap ${money(r.holds)}.`}>
              {steps.map((s) => {
                let left: number, width: number, color: string;
                if (s.kind === "base" || s.kind === "end") {
                  left = x(Math.min(0, s.value)); width = Math.abs(x(s.value) - x(0)); color = s.value < 0 ? c.loss : c.gain;
                } else {
                  left = x(run); width = x(run + s.value) - x(run); color = c.gain; run += s.value;
                }
                return (
                  <div key={s.label} className="grid grid-cols-[132px_1fr_76px] items-center gap-3 sm:grid-cols-[180px_1fr_84px]">
                    <span className={cx("truncate text-[12.5px]", s.kind === "gain" ? "text-ink-2" : "font-semibold text-ink")}>{s.label}</span>
                    <div className="relative h-6 rounded-md bg-panel-2">
                      <div className="absolute inset-y-0 w-px bg-line-2" style={{ left: `${x(0)}%` }} />
                      <motion.div
                        className="absolute inset-y-1 rounded"
                        style={{ background: color, opacity: s.kind === "gain" ? 0.9 : 1 }}
                        animate={{ left: `${left}%`, width: `${Math.max(width, s.value ? 0.4 : 0)}%` }}
                        transition={{ type: "spring", damping: 28, stiffness: 200 }}
                      />
                    </div>
                    <span className={cx("tabular text-right text-[12.5px] font-semibold", s.kind === "gain" ? "text-gain" : s.value < 0 ? "text-loss" : "text-gain")}>
                      {s.kind === "gain" ? money(s.value, { sign: "plus" }) : money(s.value)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[12px] text-ink-3">
              {r.rerouteCount} shipments rerouted · {r.holdCount} holds capped
            </p>
          </Card>

          <Card>
            <CardHeader title="Who benefits" sub="Accounts whose margin changes under these levers." />
            <div className="px-2 pb-3 sm:px-3">
              <DataTable
                rows={movers}
                rowKey={(m) => m.customer}
                dense
                empty="Move a lever to see the effect by account."
                initialSort={{ key: "gain", dir: -1 }}
                columns={[
                  { key: "customer", header: "Account", value: (m) => m.customer, render: (m) => <span className="font-medium text-ink">{m.customer}</span> },
                  { key: "before", header: "Today", value: (m) => m.before, render: (m) => <span className="text-loss">{money(m.before)}</span>, align: "right" },
                  { key: "gain", header: "Recovered", value: (m) => m.after - m.before, render: (m) => <span className="font-semibold text-gain">{money(m.after - m.before, { sign: "plus" })}</span>, align: "right" },
                  { key: "after", header: "After", value: (m) => m.after, render: (m) => <span className={m.after < 0 ? "text-loss" : "text-gain"}>{money(m.after, { sign: "plus" })}</span>, align: "right" },
                ]}
              />
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4 p-5">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Info className="size-4 text-gold" /> How the numbers are built</p>
        <ul className="mt-3 grid gap-2 text-[13px] leading-relaxed text-ink-2 md:grid-cols-3">
          <li><b className="text-ink">Reroute:</b> each eligible Pipeline Bypass shipment is re-priced at the average Cape of Good Hope cost per ton for the same product. It assumes Cape had capacity and the longer transit was acceptable.</li>
          <li><b className="text-ink">Pass-through:</b> on Pipeline and Cape shipments, the customer pays the chosen share of cost above the pre-blockade Direct rate. It is applied after rerouting, so nothing is counted twice.</li>
          <li><b className="text-ink">Hold cap:</b> for held shipments past the cap, insurance and penalties for the extra days are avoided. It assumes those costs build up evenly. Diversion costs aren&rsquo;t modelled.</li>
        </ul>
        <p className="mt-3 text-[12px] text-ink-3">These are estimates for deciding between options, not a forecast.</p>
      </Card>
    </>
  );
}
