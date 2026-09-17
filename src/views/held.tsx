"use client";

import { useMemo, useState } from "react";
import { AlertOctagon, Anchor, Clock, Hourglass, Wallet } from "lucide-react";
import { useChartColors, useFilters } from "@/components/providers";
import { Badge, Card, CardHeader, KpiCard, PageHeader, Segmented } from "@/components/ui";
import { ColumnBars, SignedBars } from "@/components/charts";
import { DataTable } from "@/components/table";
import { DATA_PULL_DATE, HELD, PRODUCTS, isEnergy, type Shipment } from "@/lib/data";
import { avg, int, money, pct, shortDate, statsBy, sum } from "@/lib/analytics";

type Action = "Divert or claim now" | "Escalate — high value" | "Monitor";

function triage(s: Shipment): { action: Action; tone: "loss" | "warn" | "neutral"; score: number } {
  const score = (s.value / 1e6) * (1 + s.delay / 30);
  if (s.delay > 30) return { action: "Divert or claim now", tone: "loss", score };
  if (s.value > 15e6) return { action: "Escalate — high value", tone: "warn", score };
  return { action: "Monitor", tone: "neutral", score };
}

export function HeldView() {
  const { rows } = useFilters();
  const c = useChartColors();
  const [view, setView] = useState<"all" | "flagged">("flagged");
  const held = useMemo(() => rows.filter((r) => r.route === HELD), [rows]);
  const cost = sum(held, (r) => r.cost);
  const waiting = sum(held, (r) => r.ins + r.pen);
  const perDay = sum(held, (r) => (r.ins + r.pen) / Math.max(1, r.delay));
  const flagged = held.filter((r) => triage(r).action !== "Monitor");
  const queue = view === "flagged" ? flagged : held;

  const bins = [
    { key: "< 10 days", lo: 0, hi: 10 },
    { key: "10–19", lo: 10, hi: 20 },
    { key: "20–29", lo: 20, hi: 30 },
    { key: "30–39", lo: 30, hi: 40 },
    { key: "40+ days", lo: 40, hi: Infinity },
  ].map((b) => ({ key: b.key, value: held.filter((r) => r.delay >= b.lo && r.delay < b.hi).length, color: b.lo >= 30 ? c.loss : c.gold }));

  const byProd = statsBy(held, (r) => r.product, PRODUCTS).map((g) => ({
    key: `${g.key} (${g.n})`, value: g.value, n: g.n, color: isEnergy(g.rows[0]) ? c.gold : c.slate,
  }));

  return (
    <>
      <PageHeader
        eyebrow={`Held in Gulf · as of ${DATA_PULL_DATE}`}
        title="Waiting is the most expensive decision"
        lede="These ships never left. No revenue can be recognized until they deliver, while war-risk insurance and late penalties keep accruing. This is a cash problem, not a routing one."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Shipments held" value={held.length} format={int} icon={<Anchor />} note={rows.length ? `${pct(held.length / rows.length)} of this view` : ""} />
        <KpiCard label="Cargo value stuck" value={sum(held, (r) => r.value)} format={(v) => money(v)} tone="warn" icon={<Wallet />} note={`${money(sum(held.filter(isEnergy), (r) => r.value))} is energy cargo`} delay={0.03} />
        <KpiCard label="Cost already paid" value={cost} format={(v) => money(v)} tone={cost ? "loss" : "neutral"} icon={<AlertOctagon />} note={`${money(sum(held, (r) => r.rev))} revenue on hold`} delay={0.06} />
        <KpiCard label="Cost of waiting" value={cost ? waiting / cost : 0} format={(v) => pct(v)} tone="loss" icon={<Hourglass />} note="insurance + penalties, not transport" delay={0.09} />
        <KpiCard label="Burn rate" value={perDay} format={(v) => `${money(v)}/day`} tone="loss" icon={<Clock />} note={held.length ? `avg ${Math.round(avg(held, (r) => r.delay))} days, longest ${Math.max(...held.map((r) => r.delay))}` : "no held shipments"} delay={0.12} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="How long they’ve been stuck" sub="Red bars are past our 30-day trigger." />
          <ColumnBars data={bins} height={290} />
        </Card>
        <Card>
          <CardHeader title="What’s stuck, by value" sub="Counts are spread across products. The money isn’t." />
          <SignedBars data={byProd} height={290} labelWidth={200} valueLabel="Cargo value" />
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Triage queue"
          sub="Ranked by cargo value × time stuck. Rule: past 30 days → divert or file the claim; over $15M → escalate."
          right={<Segmented label="Queue view" value={view} onChange={setView} options={[{ value: "flagged", label: `Flagged (${flagged.length})` }, { value: "all", label: `All (${held.length})` }]} />}
        />
        <div className="px-2 pb-3 pt-2 sm:px-3">
          <DataTable<Shipment>
            rows={queue}
            rowKey={(r) => r.id}
            pageSize={12}
            dense
            initialSort={{ key: "score", dir: -1 }}
            empty="No held shipments match this view."
            columns={[
              { key: "score", header: "Priority", value: (r) => triage(r).score, render: (r) => <span className="font-mono text-[12px] text-ink">{triage(r).score.toFixed(1)}</span>, align: "right" },
              { key: "id", header: "Shipment", value: (r) => r.id, render: (r) => <span className="font-mono text-[12px] text-ink">{r.id}</span> },
              { key: "customer", header: "Account", value: (r) => r.customer },
              { key: "product", header: "Cargo", value: (r) => r.product },
              { key: "date", header: "Departed", value: (r) => r.date, render: (r) => shortDate(r.date) },
              { key: "delay", header: "Days stuck", value: (r) => r.delay, render: (r) => <span className={r.delay > 30 ? "font-semibold text-loss" : ""}>{r.delay}</span>, align: "right" },
              { key: "value", header: "Cargo value", value: (r) => r.value, render: (r) => money(r.value), align: "right" },
              { key: "wait", header: "Waiting cost", value: (r) => r.ins + r.pen, render: (r) => money(r.ins + r.pen), align: "right" },
              { key: "action", header: "Next step", value: (r) => triage(r).action, render: (r) => <Badge tone={triage(r).tone}>{triage(r).action}</Badge> },
            ]}
          />
        </div>
      </Card>
    </>
  );
}
