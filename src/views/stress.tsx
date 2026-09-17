"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Flame, Info, TrendingDown } from "lucide-react";
import { AnimatedValue, Card, CardHeader, KpiCard, PageHeader, cx } from "@/components/ui";
import { StressChart } from "@/components/deep-charts";
import { money, pct } from "@/lib/analytics";
import { stressBaseline, stressTest } from "@/lib/deep";

export function StressView() {
  const base = useMemo(() => stressBaseline(), []);
  const [weeks, setWeeks] = useState(12);
  const [escalate, setEscalate] = useState(true);
  const r = useMemo(() => stressTest(weeks, escalate, base), [weeks, escalate, base]);
  const fill = ((weeks - 1) / 25) * 100;
  const weeklyCurrent = base.flowPerWeek + base.heldFlowPerWeek - base.stockBurnPerDay * 7;
  const weeklyPlan = base.planFlowPerWeek + base.planHeldFlowPerWeek;

  return (
    <>
      <PageHeader
        eyebrow="Stress test · forward-looking"
        title="What if the strait stays closed?"
        lede="The data covers seven weeks of blockade. This projects the next few months at the same pace, with and without our plan. It uses the full portfolio and ignores filters."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Weekly loss today" value={weeklyCurrent} format={(v) => money(v)} tone="loss" icon={<TrendingDown />} note="new shipments + ships already stuck" />
        <KpiCard label="Weekly loss with our plan" value={weeklyPlan} format={(v) => money(v)} tone={weeklyPlan < 0 ? "warn" : "gain"} note={`${pct(1 - weeklyPlan / weeklyCurrent)} lower`} delay={0.04} />
        <KpiCard label="Cost of each extra day stuck" value={base.stockBurnPerDay} format={(v) => money(v)} tone="loss" icon={<Flame />} note={`${base.heldCount} ships holding ${money(base.heldValue)} of cargo`} delay={0.08} />
        <KpiCard label="Insurance rate growth" value={base.monthlyInsGrowth} format={(v) => `+${pct(v)}`} tone="warn" icon={<CalendarRange />} note="March vs. February, per month" delay={0.12} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Additional loss from today" sub="Cumulative, on top of the $189.6M already lost." />
          <StressChart data={r.series} height={380} />
        </Card>

        <div className="grid content-start gap-3">
          <Card className="p-5">
            <label className="block">
              <span className="flex items-center justify-between text-[13px]">
                <span className="font-semibold text-ink">Blockade lasts another</span>
                <span className="tabular rounded-md bg-panel-2 px-2 py-0.5 font-semibold text-ink">{weeks} week{weeks === 1 ? "" : "s"}</span>
              </span>
              <input type="range" className="range mt-3" min={1} max={26} step={1} value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value))} style={{ ["--fill" as string]: `${fill}%` }} aria-valuetext={`${weeks} weeks`} />
              <span className="mt-1 flex justify-between text-[11px] text-ink-3"><span>1 week</span><span>6 months</span></span>
            </label>
            <button type="button" role="switch" aria-checked={escalate} onClick={() => setEscalate((e) => !e)} className="mt-4 flex items-center gap-2.5 text-[13px] text-ink-2">
              <span className={cx("relative h-5 w-9 rounded-full transition", escalate ? "bg-gold" : "bg-line-2")}>
                <span className={cx("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", escalate ? "left-[18px]" : "left-0.5")} />
              </span>
              Insurance keeps rising at the current pace
            </button>
          </Card>

          <div className="rounded-2xl border border-loss/30 bg-loss-soft p-5">
            <p className="text-[12px] font-semibold text-loss">Current playbook</p>
            <p className="tabular font-serif text-4xl font-bold text-loss"><AnimatedValue value={r.current} format={(v) => money(v)} /></p>
            <p className="mt-1 text-[12.5px] text-ink-2">more lost over {weeks} weeks</p>
          </div>
          <div className="rounded-2xl border border-gain/30 bg-gain-soft p-5">
            <p className="text-[12px] font-semibold text-gain">With our plan</p>
            <p className="tabular font-serif text-4xl font-bold text-gain"><AnimatedValue value={r.plan} format={(v) => money(v)} /></p>
            <p className="mt-1 text-[12.5px] text-ink-2">
              <b className="text-ink"><AnimatedValue value={r.saved} format={(v) => money(v, { sign: false })} /></b> avoided
            </p>
          </div>
        </div>
      </div>

      <Card className="mt-4 p-5">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Info className="size-4 text-gold" /> How the projection works</p>
        <ul className="mt-3 grid gap-2 text-[13px] leading-relaxed text-ink-2 md:grid-cols-2">
          <li><b className="text-ink">Pace:</b> losses on rerouted shipments and new Gulf holds continue at the average weekly rate seen from 1 Feb to 22 Mar ({base.weeks.toFixed(1)} weeks).</li>
          <li><b className="text-ink">Ships already stuck:</b> under the current playbook they keep accruing penalties and insurance at today&rsquo;s daily rate. Under the plan they are diverted or claimed.</li>
          <li><b className="text-ink">Our plan:</b> the simulator&rsquo;s &ldquo;Our plan&rdquo; levers — reroute, 50% pass-through for Meridian, 30-day hold cap — applied to the weekly flow.</li>
          <li><b className="text-ink">Insurance:</b> if switched on, the war-risk rate keeps rising in a straight line at the February-to-March pace (+{pct(base.monthlyInsGrowth)} of today’s level each month). It is applied to both scenarios.</li>
        </ul>
        <p className="mt-3 text-[12px] text-ink-3">This is an illustrative run-rate projection for comparing options, not a forecast.</p>
      </Card>
    </>
  );
}
