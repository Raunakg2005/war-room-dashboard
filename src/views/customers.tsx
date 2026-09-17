"use client";

import { useMemo } from "react";
import { useChartColors, useFilters } from "@/components/providers";
import { Badge, Card, CardHeader, KpiCard, PageHeader } from "@/components/ui";
import { SignedBars } from "@/components/charts";
import { DataTable } from "@/components/table";
import { ExposureHeatmap } from "@/components/visuals";
import { isEnergy } from "@/lib/data";
import { byCustomer, byRoute, money, pct, sum, type GroupStat } from "@/lib/analytics";

export function CustomersView() {
  const { rows, filters, toggleFilter } = useFilters();
  const c = useChartColors();
  const cust = useMemo(() => byCustomer(rows), [rows]);
  const totalLoss = sum(cust, (x) => Math.min(0, x.margin));
  const top = cust.slice(0, 10);
  const rest = cust.slice(10);
  const bars = [
    ...top.map((x, i) => ({ key: x.key, value: x.margin, n: x.n, color: x.margin >= 0 ? c.gain : i === 0 ? c.loss : i < 3 ? c.gold : c.slate })),
    ...(rest.length ? [{ key: `${rest.length} other customers`, value: sum(rest, (x) => x.margin), n: sum(rest, (x) => x.n), color: c.slate }] : []),
  ];
  const top3 = cust.slice(0, 3);
  const top3Share = totalLoss ? sum(top3, (x) => Math.min(0, x.margin)) / totalLoss : 0;
  const lead = cust[0];
  const energyRevShare = lead ? sum(rows.filter((r) => isEnergy(r) && r.customer === lead.key), (r) => r.rev) / (sum(rows.filter(isEnergy), (r) => r.rev) || 1) : 0;

  const mainRoute = (g: GroupStat) => byRoute(g.rows).sort((a, b) => a.margin - b.margin)[0]?.key ?? "–";

  return (
    <>
      <PageHeader
        eyebrow="Customer exposure"
        title="A handful of accounts carry the exposure"
        lede="Share of loss is recomputed on the 243 clean shipments. The dataset’s own concentration field uses a different denominator, so we don’t rely on it."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Accounts in view" value={cust.length} format={(v) => String(Math.round(v))} note={`${cust.filter((x) => x.margin < 0).length} are loss-making`} />
        <KpiCard label="Top 3 share of loss" value={top3Share} format={(v) => pct(v)} tone="loss" note={top3.map((x) => x.key.split(" ")[0]).join(" · ") || "–"} delay={0.04} />
        <KpiCard label={lead ? `${lead.key.split(" ")[0]} loss` : "Largest loss"} value={lead?.margin ?? 0} format={(v) => money(v)} tone="loss" note={lead ? `${pct(totalLoss ? Math.min(0, lead.margin) / totalLoss : 0)} of all losses · client since ${lead.rows[0].since}` : ""} delay={0.08} />
        <KpiCard label="Largest account’s share of energy revenue" value={energyRevShare} format={(v) => pct(v)} tone={energyRevShare > 0.3 ? "warn" : "neutral"} note="Our trigger: above 30% → qualify a second counterparty" delay={0.12} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader title="Gross margin by account" sub="Top 10 by size of loss. Click to focus on one account." />
          <SignedBars
            height={440}
            labelWidth={170}
            data={bars}
            selected={filters.customer || undefined}
            onSelect={(k) => { if (!k.endsWith("other customers")) toggleFilter("customer", k); }}
          />
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader title="Account × route heatmap" sub="Where each account’s money was made or lost. Darker = bigger. Click a cell to drill in." />
          <div className="px-3 pb-5 pt-3 sm:px-5"><ExposureHeatmap rows={rows} /></div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Account table" sub="Click a row to filter every view by that account." />
        <div className="px-2 pb-3 sm:px-3">
          <DataTable<GroupStat>
            rows={cust}
            rowKey={(r) => r.key}
            onRowClick={(r) => toggleFilter("customer", r.key)}
            isActive={(r) => filters.customer === r.key}
            initialSort={{ key: "margin", dir: 1 }}
            columns={[
              { key: "name", header: "Account", value: (r) => r.key, render: (r) => (
                <span className="block"><span className="block font-medium text-ink">{r.key}</span><span className="block text-[11.5px] text-ink-3">{r.rows[0].region}</span></span>
              ) },
              { key: "since", header: "Client since", value: (r) => r.rows[0].since, align: "right" },
              { key: "n", header: "Shipments", value: (r) => r.n, align: "right" },
              { key: "type", header: "Mix", value: (r) => r.rows.filter(isEnergy).length / r.n, render: (r) => {
                const e = r.rows.filter(isEnergy).length / r.n;
                return <Badge tone={e > 0.5 ? "loss" : "neutral"}>{e > 0.5 ? "Energy" : "Containerized"}</Badge>;
              } },
              { key: "rev", header: "Contracted", value: (r) => r.rev, render: (r) => money(r.rev), align: "right" },
              { key: "margin", header: "Margin", value: (r) => r.margin, render: (r) => <span className={r.margin < 0 ? "font-semibold text-loss" : "font-semibold text-gain"}>{money(r.margin, { sign: "plus" })}</span>, align: "right" },
              { key: "share", header: "Share of loss", value: (r) => (totalLoss ? Math.min(0, r.margin) / totalLoss : 0), render: (r) => {
                const s = totalLoss ? Math.min(0, r.margin) / totalLoss : 0;
                return (
                  <span className="inline-flex items-center justify-end gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-panel-2"><span className="block h-full rounded-full bg-loss" style={{ width: `${Math.max(2, s * 100)}%` }} /></span>
                    <span className="w-12 text-right">{pct(s, 1)}</span>
                  </span>
                );
              }, align: "right" },
              { key: "held", header: "Held value", value: (r) => r.heldValue, render: (r) => (r.heldValue ? money(r.heldValue) : "–"), align: "right" },
              { key: "route", header: "Costliest route", value: (r) => mainRoute(r) },
            ]}
          />
        </div>
      </Card>
    </>
  );
}
