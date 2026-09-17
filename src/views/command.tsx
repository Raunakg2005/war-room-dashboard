"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "motion/react";
import { AlertTriangle, ArrowRight, Boxes, CircleDollarSign, Clock, FlaskConical, PackageCheck, Ship, Truck } from "lucide-react";
import { useChartColors, useFilters } from "@/components/providers";
import { Badge, Card, CardHeader, KpiCard, Legend, PageHeader, cx } from "@/components/ui";
import { SignedBars, WeeklyStack, Waterfall } from "@/components/charts";
import { CorridorMap, RankShift } from "@/components/visuals";
import { MERIDIAN, ROUTES, SHIPMENTS } from "@/lib/data";
import {
  buckets, evaluateTriggers, insightsFor, int, money, pct, simulate, SCENARIOS, totals, weekly, type Filters,
} from "@/lib/analytics";

const BUCKET_FILTERS: Record<string, Partial<Filters>> = {
  "mer-pb": { group: "energy", route: "Pipeline Bypass", customer: MERIDIAN },
  "oth-pb": { group: "energy", route: "Pipeline Bypass", customer: "" },
  held: { group: "energy", route: "Held in Gulf", customer: "" },
  cape: { group: "energy", route: "Cape of Good Hope", customer: "" },
  cont: { group: "container", route: "", customer: "" },
  pre: { group: "energy", route: "Direct (Pre-Blockade)", customer: "" },
};

export function CommandView() {
  const { rows, setFilter, activeCount } = useFilters();
  const c = useChartColors();
  const t = useMemo(() => totals(rows), [rows]);
  const ins = useMemo(() => insightsFor(rows), [rows]);
  const b = useMemo(() => buckets(rows).filter((x) => x.n > 0), [rows]);
  const week = useMemo(() => weekly(rows), [rows]);
  const triggers = useMemo(() => evaluateTriggers(), []);
  const plan = useMemo(() => simulate(SHIPMENTS, SCENARIOS.find((s) => s.id === "plan")!.levers), []);
  const firing = triggers.filter((x) => x.state === "firing").length;

  const toneColor = { loss: c.loss, warn: c.gold, neutral: c.slate, gain: c.gain } as const;
  const routeColor: Record<string, string> = {
    "Direct (Pre-Blockade)": c.gain, "Cape of Good Hope": c.sky, "Pipeline Bypass": c.loss,
    "Held in Gulf": c.gold, "Overland Truck": c.ink3, "Air Bridge": c.violet,
  };
  const series = ROUTES.filter((r) => rows.some((x) => x.route === r)).map((r) => ({ key: r, color: routeColor[r] }));

  return (
    <>
      <PageHeader
        eyebrow="Command center · 5 Jan – 22 Mar 2026"
        title={t.margin < 0 ? <>The blockade cost <span className="text-loss">{money(-t.margin, { sign: false })}</span>. Here&rsquo;s exactly where.</> : <>This slice made <span className="text-gain">{money(t.margin)}</span>.</>}
        lede="Freight revenue was locked in before the blockade. Costs were not. Every view below updates with the filters, and most charts are clickable."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Shipments" value={t.n} format={int} icon={<Boxes />} note={`${int(t.n - t.held)} delivered · ${int(t.held)} held`} />
        <KpiCard label="Contracted revenue" value={t.rev} format={(v) => money(v)} icon={<CircleDollarSign />} note={`${money(t.recog)} recognized`} delay={0.03} />
        <KpiCard label="Cost to serve" value={t.cost} format={(v) => money(v)} icon={<Truck />} note={t.recog ? `${(t.cost / t.recog).toFixed(1)}× revenue recognized` : "no revenue recognized"} delay={0.06} />
        <KpiCard label="Gross margin" value={t.margin} format={(v) => money(v, { sign: "plus" })} tone={t.margin < 0 ? "loss" : "gain"} icon={<AlertTriangle />} note={t.rev ? `${pct(t.margin / t.rev)} of contracted revenue` : ""} delay={0.09} />
        <KpiCard label="On time, in full" value={t.n ? t.onTime / t.n : 0} format={(v) => pct(v)} icon={<PackageCheck />} note={`${int(t.onTime)} of ${int(t.n)} shipments`} delay={0.12} />
        <KpiCard label="Cargo stuck in Gulf" value={t.heldValue} format={(v) => money(v)} tone={t.held ? "warn" : "neutral"} icon={<Clock />} note={`${money(t.heldRev)} revenue on hold`} delay={0.15} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {ins.map((i, k) => (
          <motion.div
            key={`${i.big}-${k}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + k * 0.06 }}
            className="relative overflow-hidden rounded-2xl border border-line bg-panel-2 p-4"
          >
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: toneColor[i.tone] }} />
            <p className="tabular font-serif text-2xl font-bold" style={{ color: toneColor[i.tone] }}>{i.big}</p>
            <p className="mt-1 text-[13.5px] leading-snug text-ink-2">{i.text}</p>
          </motion.div>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Six ways through one chokepoint"
          sub="Line thickness = shipments. Moving dashes = cargo that got through. Click a route to filter everything."
          right={<Badge tone="loss"><Ship className="size-3" /> Strait closed from Feb</Badge>}
        />
        <div className="p-3 sm:p-5"><CorridorMap rows={rows} /></div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Where the revenue went" sub="Revenue recognized, minus each cost, lands at gross margin." />
          <Waterfall revenue={t.recog} freight={t.freight} fuel={t.fuel} ins={t.ins} pen={t.pen} height={320} />
        </Card>
        <Card>
          <CardHeader title="Where the loss sits" sub="Every shipment counted once, so the buckets add up to the total. Click one to drill in." />
          <SignedBars
            height={320}
            labelWidth={196}
            data={b.map((x) => ({ key: x.label, value: x.margin, n: x.n, sub: x.hint, color: toneColor[x.tone] }))}
            onSelect={(label) => {
              const id = b.find((x) => x.label === label)?.id;
              const f = id ? BUCKET_FILTERS[id] : undefined;
              if (!f) return;
              (Object.keys(f) as (keyof Filters)[]).forEach((k) => setFilter(k, f[k] as never));
            }}
          />
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Week by week"
          sub="Gross margin by departure week and route. Losses start the week the strait closes."
          right={<div className="hidden md:block"><Legend items={series.map((s) => ({ label: s.key, color: s.color }))} /></div>}
        />
        <WeeklyStack data={week} series={series} height={330} />
        <div className="px-5 pb-4 md:hidden"><Legend items={series.map((s) => ({ label: s.key, color: s.color }))} /></div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="The worst margin % is not the biggest problem"
            sub="Products ranked two ways. Containerized lines (gold) look alarming on percentage but barely move the dollars."
          />
          <div className="px-3 pb-4 sm:px-5"><RankShift rows={rows} /></div>
        </Card>
        <div className="grid gap-4 xl:col-span-2">
          <Link href="/plan" className="group rounded-2xl border border-line bg-panel p-5 shadow-glow transition hover:border-loss/50">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink-3">Live trigger monitor</p>
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-loss opacity-60" />
                <span className="relative inline-flex size-3 rounded-full bg-loss" />
              </span>
            </div>
            <p className="mt-2 font-serif text-3xl font-bold text-ink">{firing} of {triggers.length} <span className="text-loss">firing</span></p>
            <p className="mt-1 text-[13.5px] text-ink-2">Each action in our plan has a rule. These are checked against the data right now.</p>
            <p className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-gold">Open the action plan <ArrowRight className="size-4 transition group-hover:translate-x-1" /></p>
          </Link>
          <Link href="/simulator" className="group rounded-2xl border border-line bg-panel p-5 shadow-glow transition hover:border-gold/60">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink-3">What-if simulator</p>
              <FlaskConical className="size-4 text-gold" />
            </div>
            <p className="mt-2 font-serif text-3xl font-bold text-gain">+{money(plan.recovered, { sign: false })}</p>
            <p className="mt-1 text-[13.5px] text-ink-2">
              Recovered by our plan &mdash; {pct(plan.recovered / -plan.baseline)} of the loss, using three levers you can adjust.
            </p>
            <p className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-gold">Try the levers <ArrowRight className="size-4 transition group-hover:translate-x-1" /></p>
          </Link>
          {activeCount > 0 && (
            <p className={cx("rounded-xl border border-line bg-panel-2 px-4 py-3 text-[12.5px] text-ink-3")}>
              The two cards above always use the full portfolio; everything else follows your filters.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
