"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, Globe2, Handshake, Layers, Scale, ScanSearch } from "lucide-react";
import { useChartColors, useFilters } from "@/components/providers";
import { Badge, Card, CardHeader, Legend, PageHeader, cx } from "@/components/ui";
import { SignedBars } from "@/components/charts";
import { DataTable } from "@/components/table";
import { BreakEvenChart, CostBridgeChart, InsuranceClock, ParetoCurve, PenaltyScatter, TenureScatter } from "@/components/deep-charts";
import { SHIPMENTS, isEnergy } from "@/lib/data";
import { money, pct, sum } from "@/lib/analytics";
import { breakEven, byRegion, costBridge, insuranceClock, pareto, penaltyRule, tenure, COST_COMPONENTS } from "@/lib/deep";

const TABS = [
  { id: "pareto", label: "Concentration", icon: BarChart3, q: "How few shipments carry the loss?" },
  { id: "bridge", label: "Cost bridge", icon: Layers, q: "Which cost line blew up on each route?" },
  { id: "breakeven", label: "Break-even pricing", icon: Scale, q: "What rate would each route need?" },
  { id: "rules", label: "Hidden rules", icon: ScanSearch, q: "What drives penalties and insurance?" },
  { id: "tenure", label: "Relationships", icon: Handshake, q: "Are our oldest accounts our biggest risk?" },
  { id: "geo", label: "Geography", icon: Globe2, q: "Where are the exposed customers?" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Finding({ label, value, tone = "loss", children }: { label: string; value: string; tone?: "loss" | "gain" | "warn" | "ink"; children: ReactNode }) {
  const cls = { loss: "text-loss", gain: "text-gain", warn: "text-gold", ink: "text-ink" }[tone];
  return (
    <div className="rounded-2xl border border-line bg-panel-2 p-4">
      <p className="text-[12px] font-medium text-ink-3">{label}</p>
      <p className={cx("tabular mt-1 font-serif text-3xl font-bold", cls)}>{value}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{children}</p>
    </div>
  );
}

function SoWhat({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gold/40 bg-gold-soft p-4">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold">So what</p>
      <p className="mt-1 text-[14px] leading-relaxed text-ink">{children}</p>
    </div>
  );
}

export function DeepDivesView() {
  const { rows, toggleFilter } = useFilters();
  const c = useChartColors();
  const [tab, setTab] = useState<TabId>("pareto");

  useEffect(() => {
    const h = window.location.hash.slice(1) as TabId;
    if (TABS.some((t) => t.id === h)) setTab(h);
  }, []);
  const choose = (id: TabId) => {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
  };

  const par = useMemo(() => pareto(rows), [rows]);
  const bridge = useMemo(() => costBridge(rows), [rows]);
  const be = useMemo(() => breakEven(rows), [rows]);
  const rule = useMemo(() => penaltyRule(rows), [rows]);
  const clock = useMemo(() => insuranceClock(rows), [rows]);
  const ten = useMemo(() => tenure(rows), [rows]);
  const regions = useMemo(() => byRegion(rows), [rows]);
  const fullClock = useMemo(() => insuranceClock(SHIPMENTS), []);
  const pre = fullClock.filter((w) => w.week < "2026-02-01");
  const lastWeek = fullClock[fullClock.length - 1];
  const preRate = pre.length ? sum(pre, (w) => w.rate) / pre.length : 0;

  const active = TABS.find((t) => t.id === tab)!;
  const regionLoss = sum(regions, (r) => Math.min(0, r.margin));

  return (
    <>
      <PageHeader
        eyebrow="Deep dives"
        title="Six ways to interrogate the loss"
        lede="Each tab is a different analytical lens: concentration, variance, pricing, rule discovery, relationships and geography. All of them follow your filters."
      />

      <div role="tablist" aria-label="Analyses" className="scrollbar-thin -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => choose(t.id)}
              className={cx(
                "flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13.5px] font-medium transition",
                on ? "border-gold bg-gold-soft text-gold" : "border-line bg-panel text-ink-2 hover:text-ink",
              )}
            >
              <Icon className="size-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <p className="mb-4 font-serif text-xl font-semibold text-ink">{active.q}</p>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {tab === "pareto" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader title="Pareto curve of the loss" sub="Shipments sorted from biggest loss to smallest. The steeper the start, the more concentrated the problem." />
                <ParetoCurve data={par} height={360} />
              </Card>
              <div className="grid content-start gap-3">
                <Finding label="Half the loss comes from" value={par.p50 ? `${par.p50.count} shipments` : "–"}>
                  That&rsquo;s {par.p50 ? pct(par.p50.share, 1) : "–"} of the {par.n} shipments in view.
                </Finding>
                <Finding label="80% of the loss comes from" value={par.p80 ? `${par.p80.count} shipments` : "–"} tone="warn">
                  {par.p80 ? pct(par.p80.share, 1) : "–"} of shipments. {par.lossMakers} of {par.n} lost money in total.
                </Finding>
                <SoWhat>Fixing a few dozen energy shipments matters more than improving hundreds of small ones. Management attention should follow the dollars.</SoWhat>
              </div>
              <Card className="xl:col-span-2">
                <CardHeader title="The ten biggest single losses" />
                <div className="px-2 pb-3 sm:px-3">
                  <DataTable
                    rows={par.top}
                    rowKey={(r) => r.id}
                    dense
                    initialSort={{ key: "margin", dir: 1 }}
                    columns={[
                      { key: "id", header: "Shipment", value: (r) => r.id, render: (r) => <span className="font-mono text-[12px] text-ink">{r.id}</span> },
                      { key: "customer", header: "Account", value: (r) => r.customer },
                      { key: "product", header: "Cargo", value: (r) => r.product },
                      { key: "route", header: "Route", value: (r) => r.route },
                      { key: "margin", header: "Margin", value: (r) => r.margin, render: (r) => <span className="font-semibold text-loss">{money(r.margin)}</span>, align: "right" },
                      { key: "share", header: "Share of loss", value: (r) => r.margin / par.totalLoss, render: (r) => pct(r.margin / par.totalLoss, 1), align: "right" },
                    ]}
                  />
                </div>
              </Card>
            </div>
          )}

          {tab === "bridge" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card>
                <CardHeader
                  title="Energy cargo: what a ton cost to move"
                  sub="Weighted by tonnage and split by cost line. The dashed line is what the contracts pay per ton."
                  right={<div className="hidden sm:block"><Legend items={[{ label: "Freight", color: c.sky }, { label: "Fuel", color: c.slate }, { label: "Insurance", color: c.gold }, { label: "Penalties", color: c.loss }]} /></div>}
                />
                <CostBridgeChart data={bridge} height={360} />
              </Card>
              <div className="grid content-start gap-3">
                <Card>
                  <CardHeader title="Change vs. pre-blockade, per ton" sub="Which cost line moved the most on each route." />
                  <div className="px-2 pb-3 sm:px-3">
                    <DataTable
                      rows={bridge.routes}
                      rowKey={(r) => r.route}
                      dense
                      columns={[
                        { key: "route", header: "Route", value: (r) => r.route, render: (r) => <span className="font-medium text-ink">{r.route}</span> },
                        ...COST_COMPONENTS.map((k) => ({
                          key: k.key, header: k.label.split(" ").slice(-1)[0], align: "right" as const,
                          value: (r: (typeof bridge.routes)[number]) => r.delta[k.key],
                          render: (r: (typeof bridge.routes)[number]) => (
                            <span className={cx(r.biggest === k.key && "font-bold text-loss")}>{r.delta[k.key] >= 0 ? "+" : "−"}${Math.abs(r.delta[k.key]).toFixed(2)}</span>
                          ),
                        })),
                      ]}
                    />
                  </div>
                </Card>
                <SoWhat>
                  On Pipeline Bypass, freight and fuel drive the damage — a pricing problem. On Held in Gulf, late penalties dominate — a waiting problem. Different causes need different fixes.
                </SoWhat>
              </div>
            </div>
          )}

          {tab === "breakeven" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card>
                <CardHeader title="Rate change needed to break even" sub="Contracted revenue would have to rise (or could fall) by this much to cover cost on each route. Delivered shipments only." />
                <BreakEvenChart data={be} height={Math.max(260, be.length * 44)} />
              </Card>
              <div className="grid content-start gap-3">
                {be[0] && (
                  <Finding label="Hardest to fix with price alone" value={`+${pct(be[0].uplift)}`}>
                    {be[0].key}: contracts would need to be {(be[0].uplift + 1).toFixed(1)}× today&rsquo;s rate. No customer accepts that, so the route itself has to change.
                  </Finding>
                )}
                {be.filter((b) => b.uplift < 0).slice(0, 1).map((b) => (
                  <Finding key={b.key} label="Already profitable" value={pct(b.uplift)} tone="gain">
                    {b.key} covers its cost with {pct(-b.uplift)} to spare — protect it.
                  </Finding>
                ))}
                <SoWhat>Repricing works where the gap is modest (Cape of Good Hope). Where cost is 3–4× revenue (Pipeline, Air), the answer is rerouting or restricting, not negotiation.</SoWhat>
              </div>
            </div>
          )}

          {tab === "rules" && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Late penalties follow an exact formula"
                  sub="Each dot is a late shipment. Every one sits on its line: penalty = a fixed % of cargo value for each day late."
                  right={<Badge tone="info">Rule found in data</Badge>}
                />
                <PenaltyScatter data={rule} height={340} />
              </Card>
              <Card>
                <CardHeader title="War-risk insurance keeps climbing" sub="Insurance as a share of cargo value, by departure week." right={<Badge tone="warn">Rising</Badge>} />
                <InsuranceClock data={clock} height={340} />
              </Card>
              <div className="grid gap-3 sm:grid-cols-3 xl:col-span-2">
                <Finding label="Penalty per day late (delivered)" value={pct(rule.deliveredRate, 1)} tone="warn">
                  of cargo value. All {rule.onTimeCount} on-time shipments carry {rule.onTimeZero ? "zero" : "some"} penalty.
                </Finding>
                <Finding label="Penalty per day (held in Gulf)" value={pct(rule.heldRate, 1)}>
                  of cargo value — 50% steeper than for delivered cargo. Every day a ship waits is expensive.
                </Finding>
                <Finding label="Insurance rate, latest week" value={lastWeek ? pct(lastWeek.rate, 2) : "–"} tone="warn">
                  vs {pct(preRate, 2)} before the blockade — about {preRate ? (lastWeek.rate / preRate).toFixed(1) : "–"}× higher.
                </Finding>
              </div>
              <div className="xl:col-span-2">
                <SoWhat>
                  Because penalties grow with every day and insurance rises every week, waiting is never free. That is why our plan puts a hard 30-day limit on Gulf holds.
                </SoWhat>
              </div>
            </div>
          )}

          {tab === "tenure" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card>
                <CardHeader title="Years as a client vs. margin" sub="Bubble size = contracted revenue. Click a bubble to focus on that account." />
                <TenureScatter data={ten} height={380} onSelect={(k) => toggleFilter("customer", k)} />
              </Card>
              <div className="grid content-start gap-3">
                {(() => {
                  const old = ten.filter((t) => t.years >= 10);
                  const young = ten.filter((t) => t.years < 10);
                  return (
                    <>
                      <Finding label="Accounts with 10+ years" value={money(sum(old, (t) => t.margin))}>
                        {old.length} accounts. {old.filter((t) => t.energy).length} of them are energy accounts.
                      </Finding>
                      <Finding label="Accounts under 10 years" value={money(sum(young, (t) => t.margin))} tone="warn">
                        {young.length} accounts.
                      </Finding>
                    </>
                  );
                })()}
                <SoWhat>
                  Long-standing energy accounts carry the biggest losses. They are also the relationships most worth keeping, so the lever is contract terms, not exits.
                </SoWhat>
              </div>
            </div>
          )}

          {tab === "geo" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card>
                <CardHeader title="Gross margin by customer region" sub="Where the exposed customers are based." />
                <SignedBars height={300} data={regions.map((r) => ({ key: r.key, value: r.margin, n: r.n }))} onSelect={(k) => toggleFilter("region", k)} />
              </Card>
              <Card>
                <CardHeader title="Region mix" sub="Shipments and energy share by region." />
                <div className="px-2 pb-3 sm:px-3">
                  <DataTable
                    rows={regions}
                    rowKey={(r) => r.key}
                    dense
                    onRowClick={(r) => toggleFilter("region", r.key)}
                    initialSort={{ key: "margin", dir: 1 }}
                    columns={[
                      { key: "region", header: "Region", value: (r) => r.key, render: (r) => <span className="font-medium text-ink">{r.key}</span> },
                      { key: "n", header: "Shipments", value: (r) => r.n, align: "right" },
                      { key: "energy", header: "Energy", value: (r) => r.rows.filter(isEnergy).length / r.n, render: (r) => pct(r.rows.filter(isEnergy).length / r.n), align: "right" },
                      { key: "margin", header: "Margin", value: (r) => r.margin, render: (r) => <span className={r.margin < 0 ? "font-semibold text-loss" : "font-semibold text-gain"}>{money(r.margin, { sign: "plus" })}</span>, align: "right" },
                      { key: "share", header: "Share of loss", value: (r) => (regionLoss ? Math.min(0, r.margin) / regionLoss : 0), render: (r) => pct(regionLoss ? Math.min(0, r.margin) / regionLoss : 0, 1), align: "right" },
                    ]}
                  />
                </div>
              </Card>
              <div className="xl:col-span-2">
                <SoWhat>
                  Europe and East Asia hold almost all the exposure, because that is where the energy buyers are. Region is a symptom of cargo type, not a separate risk.
                </SoWhat>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
