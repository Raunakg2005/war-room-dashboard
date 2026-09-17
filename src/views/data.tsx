"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, Search, ShieldAlert, Wrench } from "lucide-react";
import { useFilters } from "@/components/providers";
import { Badge, Card, CardHeader, PageHeader, cx } from "@/components/ui";
import { DataTable } from "@/components/table";
import { AUDIT, HELD, type Shipment } from "@/lib/data";
import { int, money, pct, shortDate } from "@/lib/analytics";

type Status = "pass" | "fixed" | "excluded";

const checks: { status: Status; title: string; detail: string }[] = [
  { status: "pass", title: `${AUDIT.rows} rows, ${AUDIT.uniqueIds} unique shipment IDs`, detail: "No duplicates in Shipment_Data, so no rows were dropped." },
  { status: "pass", title: `Costs add up on ${AUDIT.componentsReconcile}/${AUDIT.rows} rows`, detail: "Freight + fuel + insurance + penalty = total cost to serve." },
  { status: "pass", title: `Margin reconciles on ${AUDIT.marginReconcile}/${AUDIT.rows} rows`, detail: `Revenue recognized − cost = gross margin. Portfolio total: ${money(AUDIT.totalMargin)}.` },
  { status: "pass", title: `All ${AUDIT.heldCount} held shipments have $0 revenue and no transit time`, detail: "Matches the data dictionary: they were undelivered at the data pull." },
  { status: "fixed", title: `${AUDIT.insuranceBlank.length} blank insurance values filled in`, detail: `${AUDIT.insuranceBlank.join(", ")}: filled in as total − freight − fuel − penalty. Totals and margins are unchanged.` },
  { status: "fixed", title: `${Object.values(AUDIT.regionVariants).reduce((a, b) => a + b, 0)} region labels standardised`, detail: `Lower-case variants (${Object.keys(AUDIT.regionVariants).map((k) => `“${k}”`).join(", ")}) merged into their proper regions.` },
  { status: "excluded", title: "Customer_Concentration_Risk_Pct not used", detail: `It is calculated against “the raw dataset”, which contains duplicate IDs. It shows Meridian at ${AUDIT.meridianConcentrationField}%; recomputed on the clean rows, Meridian is ${AUDIT.meridianRevenueShareRecomputed}% of revenue.` },
  { status: "excluded", title: "Gross_Margin_Pct not used to rank routes", detail: "The dictionary warns it looks extreme for Air Bridge and Overland Truck, which were priced as emergency substitutes. We rank by dollars and per-ton economics instead." },
];

const STATUS: Record<Status, { label: string; tone: "gain" | "warn" | "loss"; icon: typeof CheckCircle2 }> = {
  pass: { label: "Checked", tone: "gain", icon: CheckCircle2 },
  fixed: { label: "Fixed", tone: "warn", icon: Wrench },
  excluded: { label: "Left out", tone: "loss", icon: ShieldAlert },
};

const CSV_COLUMNS: [keyof Shipment, string][] = [
  ["id", "Shipment_ID"], ["date", "Departure_Date"], ["customer", "Customer"], ["region", "Region"], ["since", "Customer_Since"],
  ["product", "Product"], ["cargo", "Cargo_Type"], ["route", "Route"], ["tons", "Tons"], ["value", "Cargo_Value_USD"],
  ["rev", "Contracted_Revenue_USD"], ["recog", "Revenue_Recognized_USD"], ["freight", "Freight_USD"], ["fuel", "Fuel_USD"],
  ["ins", "Insurance_USD"], ["pen", "Penalty_USD"], ["cost", "Cost_to_Serve_USD"], ["margin", "Gross_Margin_USD"],
  ["plan", "Planned_Days"], ["actual", "Actual_Days"], ["delay", "Delay_Days"], ["difot", "DIFOT_Met"], ["imputed", "Insurance_Imputed"],
];

function toCSV(rows: readonly Shipment[]) {
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "boolean" ? (v ? "Y" : "N") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [CSV_COLUMNS.map((c) => c[1]).join(","), ...rows.map((r) => CSV_COLUMNS.map(([k]) => cell(r[k])).join(","))].join("\n");
}

export function DataView() {
  const { rows } = useFilters();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => [r.id, r.customer, r.product, r.route, r.region].some((v) => v.toLowerCase().includes(s))) : rows;
  }, [rows, q]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([toCSV(list)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "war-room-shipments.csv" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <PageHeader
        eyebrow="Data & method"
        title="What we checked, fixed and left out"
        lede="The brief warns that not every field should be trusted. Here is every call we made on the data, and every shipment behind the numbers."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {checks.map((c) => {
          const s = STATUS[c.status];
          const Icon = s.icon;
          return (
            <div key={c.title} className="flex gap-3 rounded-2xl border border-line bg-panel p-4">
              <Icon className={cx("mt-0.5 size-5 shrink-0", s.tone === "gain" ? "text-gain" : s.tone === "warn" ? "text-gold" : "text-loss")} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-semibold text-ink">{c.title}</p>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <p className="mt-1 text-[13px] leading-snug text-ink-2">{c.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Shipment explorer"
          sub="Every row behind the dashboard, following the current filters."
          right={
            <button type="button" onClick={download} className="flex items-center gap-2 rounded-xl border border-line bg-panel-2 px-3 py-2 text-[13px] font-medium text-ink-2 hover:text-ink">
              <Download className="size-4" /> <span className="hidden sm:inline">Download CSV</span>
            </button>
          }
        />
        <div className="px-5 pt-3">
          <label className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 focus-within:border-gold">
            <Search className="size-4 text-ink-3" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by ID, account, product, route or region"
              aria-label="Search shipments"
              className="w-full bg-transparent py-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-3"
            />
            <span className="tabular shrink-0 text-[12px] text-ink-3">{int(list.length)} rows</span>
          </label>
        </div>
        <div className="px-2 pb-3 pt-2 sm:px-3">
          <DataTable<Shipment>
            rows={list}
            rowKey={(r) => r.id}
            pageSize={20}
            dense
            initialSort={{ key: "margin", dir: 1 }}
            columns={[
              { key: "id", header: "ID", value: (r) => r.id, render: (r) => <span className="font-mono text-[12px] text-ink">{r.id}{r.imputed && <span title="Insurance filled in" className="ml-1 text-gold">*</span>}</span> },
              { key: "date", header: "Departed", value: (r) => r.date, render: (r) => shortDate(r.date) },
              { key: "customer", header: "Account", value: (r) => r.customer },
              { key: "product", header: "Product", value: (r) => r.product },
              { key: "route", header: "Route", value: (r) => r.route },
              { key: "tons", header: "Tons", value: (r) => r.tons, render: (r) => int(r.tons), align: "right" },
              { key: "rev", header: "Revenue", value: (r) => r.rev, render: (r) => money(r.rev), align: "right" },
              { key: "cost", header: "Cost", value: (r) => r.cost, render: (r) => money(r.cost), align: "right" },
              { key: "margin", header: "Margin", value: (r) => r.margin, render: (r) => <span className={r.margin < 0 ? "font-semibold text-loss" : "font-semibold text-gain"}>{money(r.margin, { sign: "plus" })}</span>, align: "right" },
              { key: "mpct", header: "Margin %", value: (r) => r.margin / r.rev, render: (r) => pct(r.margin / r.rev), align: "right" },
              { key: "delay", header: "Delay", value: (r) => r.delay, align: "right" },
              { key: "difot", header: "Delivery", value: (r) => (r.route === HELD ? 0 : r.difot ? 2 : 1), render: (r) => (
                r.route === HELD ? <Badge tone="warn">Held</Badge> : r.difot ? <Badge tone="gain">On time</Badge> : <Badge tone="loss">Late</Badge>
              ) },
            ]}
          />
        </div>
        <p className="px-5 pb-4 text-[11.5px] text-ink-3">* Insurance cost was blank in the source and has been filled in.</p>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="text-[15px] font-semibold text-ink">Glossary</p>
          <dl className="mt-3 space-y-3 text-[13px]">
            {[
              ["Contracted revenue", "The freight fee agreed before the blockade. It doesn’t change with the route used."],
              ["Revenue recognized", "Contracted revenue actually earned. $0 for shipments still held in the Gulf."],
              ["Cost to serve", "Freight + fuel + war-risk insurance + late-delivery penalties."],
              ["Gross margin", "Revenue recognized minus cost to serve. Negative means a loss."],
              ["On time, in full (DIFOT)", "Whether a shipment met the contract’s delivery promise."],
              ["Energy cargo", "Crude oil and refined petrochemicals, moved in bulk tankers."],
            ].map(([t, d]) => (
              <div key={t}><dt className="font-semibold text-ink">{t}</dt><dd className="text-ink-2">{d}</dd></div>
            ))}
          </dl>
        </Card>
        <Card className="p-5">
          <p className="text-[15px] font-semibold text-ink">Assumptions</p>
          <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-ink-2">
            <li>Direct (Pre-Blockade) shipments ran 5–31 Jan with the same customers and contracts, so they are the cost-per-ton baseline for energy cargo.</li>
            <li>Routes were chosen, not randomly assigned. Differences between routes also reflect the cargo put on them; only energy cargo used Pipeline Bypass.</li>
            <li>Held in Gulf delays are days stuck as of {"22 Mar 2026"}, not completed transits.</li>
            <li>Simulator results are estimates for comparing options, with their assumptions shown on that page.</li>
            <li>All values are in USD, as in the source data.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
