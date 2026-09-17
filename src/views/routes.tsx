"use client";

import { useMemo } from "react";
import { useChartColors, useFilters } from "@/components/providers";
import { Badge, Card, CardHeader, Legend, PageHeader } from "@/components/ui";
import { CostMix, PerTon, ServiceBubbles, SignedBars } from "@/components/charts";
import { DataTable } from "@/components/table";
import { isEnergy, SHORT_ROUTE, type Route } from "@/lib/data";
import { byRoute, CAPE_CPT, costPerTon, DIRECT_CPT, money, pct, revPerTon, times, type GroupStat } from "@/lib/analytics";

export function RoutesView() {
  const { rows, filters, toggleFilter } = useFilters();
  const c = useChartColors();
  const routes = useMemo(() => byRoute(rows), [rows]);
  const energyRoutes = useMemo(
    () => byRoute(rows.filter(isEnergy)).filter((r) => r.key !== "Overland Truck" && r.key !== "Air Bridge"),
    [rows],
  );

  const colorOf = (r: string) => ({
    "Direct (Pre-Blockade)": c.gain, "Cape of Good Hope": c.sky, "Pipeline Bypass": c.loss,
    "Held in Gulf": c.gold, "Overland Truck": c.ink3, "Air Bridge": c.violet,
  } as Record<string, string>)[r];

  const pb = energyRoutes.find((r) => r.key === "Pipeline Bypass");
  const direct = energyRoutes.find((r) => r.key === "Direct (Pre-Blockade)");
  const multiple = pb && direct ? costPerTon(pb.rows) / costPerTon(direct.rows) : null;

  return (
    <>
      <PageHeader
        eyebrow="Route economics"
        title="Revenue per ton stayed flat. Cost per ton didn’t."
        lede="Shipment sizes vary more than 100×, so routes are compared per ton. Contracted revenue never repriced when cargo had to switch routes."
        right={multiple ? (
          <div className="rounded-2xl border border-loss/30 bg-loss-soft px-5 py-4">
            <p className="text-[12px] font-semibold text-loss">Pipeline Bypass vs. pre-blockade</p>
            <p className="tabular font-serif text-4xl font-bold text-loss">{times(multiple)}</p>
            <p className="text-[12px] text-ink-2">cost per ton, energy cargo</p>
          </div>
        ) : undefined}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Energy cargo: cost vs. revenue per ton"
            sub="Bars = cost per ton. Gold line = contracted revenue per ton. Average per shipment."
            right={<Legend items={[{ label: "Cost", color: c.loss }, { label: "Revenue", color: c.gold }]} />}
          />
          <PerTon
            height={320}
            data={energyRoutes.map((r) => ({
              key: SHORT_ROUTE[r.key as Route] === "Direct" ? "Direct (pre)" : r.key,
              cost: costPerTon(r.rows), rev: revPerTon(r.rows), n: r.n,
            }))}
          />
        </Card>
        <Card>
          <CardHeader title="Gross margin by route" sub="Click a route to filter every view." />
          <SignedBars
            height={320}
            data={routes.map((r) => ({ key: r.key, value: r.margin, n: r.n }))}
            selected={filters.route || undefined}
            onSelect={(k) => toggleFilter("route", k as Route)}
          />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Service vs. economics"
            sub="Bubble size = shipments. Top right is where you want to be: on time and profitable."
          />
          <ServiceBubbles
            height={340}
            onSelect={(k) => toggleFilter("route", k as Route)}
            data={routes.map((r) => ({
              key: r.key,
              label: SHORT_ROUTE[r.key as Route],
              difot: r.onTime / r.n,
              marginPerRev: r.rev ? r.margin / r.rev : 0,
              n: r.n,
              margin: r.margin,
              color: colorOf(r.key),
            }))}
          />
        </Card>
        <Card>
          <CardHeader
            title="What each route’s cost is made of"
            sub="Held in Gulf is almost all insurance and penalties — the cost of waiting, not moving."
          />
          <CostMix height={340} data={routes.map((r) => ({ key: r.key, freight: r.freight, fuel: r.fuel, ins: r.ins, pen: r.pen }))} />
          <div className="px-5 pb-4">
            <Legend items={[
              { label: "Freight", color: c.sky }, { label: "Fuel", color: c.slate },
              { label: "War-risk insurance", color: c.gold }, { label: "Late penalties", color: c.loss },
            ]} />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Route scorecard" sub="Totals for the current filter. Click a row to filter by that route." />
        <div className="px-2 pb-3 sm:px-3">
          <DataTable<GroupStat>
            rows={routes}
            rowKey={(r) => r.key}
            onRowClick={(r) => toggleFilter("route", r.key as Route)}
            isActive={(r) => filters.route === r.key}
            initialSort={{ key: "margin", dir: 1 }}
            columns={[
              { key: "route", header: "Route", value: (r) => r.key, render: (r) => (
                <span className="flex items-center gap-2 font-medium text-ink"><span className="size-2.5 rounded-sm" style={{ background: colorOf(r.key) }} />{r.key}</span>
              ) },
              { key: "n", header: "Shipments", value: (r) => r.n, align: "right" },
              { key: "rev", header: "Contracted", value: (r) => r.rev, render: (r) => money(r.rev), align: "right" },
              { key: "cost", header: "Cost", value: (r) => r.cost, render: (r) => money(r.cost), align: "right" },
              { key: "margin", header: "Margin", value: (r) => r.margin, render: (r) => <span className={r.margin < 0 ? "font-semibold text-loss" : "font-semibold text-gain"}>{money(r.margin, { sign: "plus" })}</span>, align: "right" },
              { key: "ratio", header: "Cost ÷ revenue", value: (r) => (r.rev ? r.cost / r.rev : null), render: (r) => (r.rev ? times(r.cost / r.rev) : "–"), align: "right" },
              { key: "wait", header: "Insurance + penalties", value: (r) => (r.ins + r.pen) / r.cost, render: (r) => pct((r.ins + r.pen) / r.cost), align: "right" },
              { key: "difot", header: "On time", value: (r) => r.onTime / r.n, render: (r) => {
                const v = r.onTime / r.n;
                return <Badge tone={v >= 0.95 ? "gain" : v < 0.7 ? "loss" : "warn"}>{pct(v)}</Badge>;
              }, align: "right" },
            ]}
          />
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Benchmarks used across the dashboard" sub="Average cost per ton by product, full portfolio. The simulator re-prices Pipeline shipments at the Cape benchmark." />
        <div className="grid gap-3 px-5 pb-5 pt-3 sm:grid-cols-2">
          {(["Crude Oil", "Refined Petrochemicals"] as const).map((p) => (
            <div key={p} className="rounded-xl border border-line bg-panel-2 p-4">
              <p className="text-[13px] font-semibold text-ink">{p}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-[12.5px]">
                <dt className="text-ink-3">Direct (pre-blockade)</dt><dd className="tabular text-right text-ink">${DIRECT_CPT[p].toFixed(2)}/t</dd>
                <dt className="text-ink-3">Cape of Good Hope</dt><dd className="tabular text-right text-ink">${CAPE_CPT[p].toFixed(2)}/t</dd>
              </dl>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
