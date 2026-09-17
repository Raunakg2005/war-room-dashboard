import {
  ENERGY, HELD, MERIDIAN, PRODUCTS, ROUTES, SHIPMENTS, isEnergy,
  type Product, type Route, type Shipment,
} from "./data";

/* ---------------- formatting ---------------- */

const MINUS = "−";

export function money(v: number, opts: { sign?: boolean | "plus"; digits?: number } = {}): string {
  const { sign = true, digits = 1 } = opts;
  const a = Math.abs(v);
  let s: string;
  if (a >= 1e9) s = `$${(a / 1e9).toFixed(digits)}B`;
  else if (a >= 1e6) s = `$${(a / 1e6).toFixed(digits)}M`;
  else if (a >= 1e3) s = `$${(a / 1e3).toFixed(digits)}K`;
  else s = `$${a.toFixed(0)}`;
  if (v < 0 && sign) return MINUS + s;
  if (v > 0 && sign === "plus") return `+${s}`;
  return s;
}

export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`.replace("-", MINUS);
export const int = (v: number) => Math.round(v).toLocaleString("en-US");
export const times = (v: number, d = 1) => `${v.toFixed(d)}×`;
export const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/* ---------------- basic helpers ---------------- */

export const sum = <T,>(arr: readonly T[], f: (x: T) => number) => arr.reduce((a, x) => a + (f(x) || 0), 0);
export const avg = <T,>(arr: readonly T[], f: (x: T) => number) => (arr.length ? sum(arr, f) / arr.length : 0);

export function groupBy<T, K>(arr: readonly T[], f: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of arr) {
    const k = f(x);
    const list = m.get(k);
    if (list) list.push(x);
    else m.set(k, [x]);
  }
  return m;
}

/* ---------------- filters ---------------- */

export interface Filters {
  group: "" | "energy" | "container";
  route: "" | Route;
  product: "" | Product;
  customer: string;
  region: string;
}

export const EMPTY_FILTERS: Filters = { group: "", route: "", product: "", customer: "", region: "" };

export function applyFilters(rows: readonly Shipment[], f: Filters): Shipment[] {
  return rows.filter((r) =>
    (!f.group || (f.group === "energy" ? isEnergy(r) : !isEnergy(r))) &&
    (!f.route || r.route === f.route) &&
    (!f.product || r.product === f.product) &&
    (!f.customer || r.customer === f.customer) &&
    (!f.region || r.region === f.region));
}

export function describeFilters(f: Filters): string[] {
  const out: string[] = [];
  if (f.group) out.push(f.group === "energy" ? "Energy cargo" : "Containerized cargo");
  if (f.route) out.push(f.route);
  if (f.product) out.push(f.product);
  if (f.customer) out.push(f.customer);
  if (f.region) out.push(f.region);
  return out;
}

/* ---------------- totals ---------------- */

export interface Totals {
  n: number;
  rev: number;
  recog: number;
  cost: number;
  margin: number;
  tons: number;
  value: number;
  onTime: number;
  held: number;
  heldValue: number;
  heldRev: number;
  freight: number;
  fuel: number;
  ins: number;
  pen: number;
}

export function totals(rows: readonly Shipment[]): Totals {
  const heldRows = rows.filter((r) => r.route === HELD);
  return {
    n: rows.length,
    rev: sum(rows, (r) => r.rev),
    recog: sum(rows, (r) => r.recog),
    cost: sum(rows, (r) => r.cost),
    margin: sum(rows, (r) => r.margin),
    tons: sum(rows, (r) => r.tons),
    value: sum(rows, (r) => r.value),
    onTime: rows.filter((r) => r.difot).length,
    held: heldRows.length,
    heldValue: sum(heldRows, (r) => r.value),
    heldRev: sum(heldRows, (r) => r.rev),
    freight: sum(rows, (r) => r.freight),
    fuel: sum(rows, (r) => r.fuel),
    ins: sum(rows, (r) => r.ins),
    pen: sum(rows, (r) => r.pen),
  };
}

export interface GroupStat extends Totals {
  key: string;
  rows: Shipment[];
}

export function statsBy<K extends string>(rows: readonly Shipment[], key: (s: Shipment) => K, order?: readonly K[]): GroupStat[] {
  const g = groupBy(rows, key);
  const keys = order ? order.filter((k) => g.has(k)) : [...g.keys()];
  return keys.map((k) => ({ key: k, rows: g.get(k)!, ...totals(g.get(k)!) }));
}

export const byRoute = (rows: readonly Shipment[]) => statsBy(rows, (r) => r.route, ROUTES);
export const byProduct = (rows: readonly Shipment[]) => statsBy(rows, (r) => r.product, PRODUCTS);
export const byCustomer = (rows: readonly Shipment[]) =>
  statsBy(rows, (r) => r.customer).sort((a, b) => a.margin - b.margin);

/* ---------------- loss buckets (mutually exclusive) ---------------- */

export interface Bucket {
  id: string;
  label: string;
  hint: string;
  margin: number;
  n: number;
  tone: "loss" | "warn" | "neutral" | "gain";
}

const BUCKETS: { id: string; label: string; hint: string; tone: Bucket["tone"]; test: (s: Shipment) => boolean }[] = [
  { id: "mer-pb", label: "Meridian × Pipeline Bypass", hint: "One account on one route", tone: "loss", test: (s) => isEnergy(s) && s.route === "Pipeline Bypass" && s.customer === MERIDIAN },
  { id: "oth-pb", label: "Other accounts × Pipeline Bypass", hint: "Zenith, Pacific Rim, Baltic, Nordholm", tone: "loss", test: (s) => isEnergy(s) && s.route === "Pipeline Bypass" },
  { id: "held", label: "Energy cargo held in Gulf", hint: "Cost paid, no revenue yet", tone: "warn", test: (s) => isEnergy(s) && s.route === HELD },
  { id: "cape", label: "Energy cargo via Cape", hint: "Longer route, ~2× cost per ton", tone: "neutral", test: (s) => isEnergy(s) && s.route === "Cape of Good Hope" },
  { id: "cont", label: "All containerized cargo", hint: "165 shipments, every route", tone: "neutral", test: (s) => !isEnergy(s) },
  { id: "pre", label: "Energy cargo, pre-blockade", hint: "Direct route, Jan 5–31", tone: "gain", test: (s) => isEnergy(s) },
];

export function buckets(rows: readonly Shipment[]): Bucket[] {
  const out = BUCKETS.map((b) => ({ id: b.id, label: b.label, hint: b.hint, tone: b.tone, margin: 0, n: 0 }));
  for (const r of rows) {
    const i = BUCKETS.findIndex((b) => b.test(r));
    out[i].margin += r.margin;
    out[i].n += 1;
  }
  return out;
}

/* ---------------- unit economics ---------------- */

export const costPerTon = (rows: readonly Shipment[]) => avg(rows, (r) => r.cost / r.tons);
export const revPerTon = (rows: readonly Shipment[]) => avg(rows, (r) => r.rev / r.tons);

/** Average cost per ton for a product on a given route (full dataset). */
export function benchmarkCPT(route: Route): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [p, list] of groupBy(SHIPMENTS.filter((s) => s.route === route), (s) => s.product)) {
    out[p] = costPerTon(list);
  }
  return out;
}

export const CAPE_CPT = benchmarkCPT("Cape of Good Hope");
export const DIRECT_CPT = benchmarkCPT("Direct (Pre-Blockade)");

/* ---------------- weekly series ---------------- */

export function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function weekly(rows: readonly Shipment[]) {
  const weeks = [...new Set(rows.map((r) => weekStart(r.date)))].sort();
  return weeks.map((w) => {
    const inWeek = rows.filter((r) => weekStart(r.date) === w);
    const row: Record<string, number | string> = { week: w, label: shortDate(w), total: sum(inWeek, (r) => r.margin) };
    for (const rt of ROUTES) {
      const v = sum(inWeek.filter((r) => r.route === rt), (r) => r.margin);
      row[rt] = v ? v / 1e6 : 0;
    }
    return row;
  });
}

/* ---------------- what-if simulator ---------------- */

export interface Levers {
  /** 0..1 share of eligible Pipeline Bypass energy volume moved to Cape of Good Hope */
  reroute: number;
  /** include Meridian in the reroute lever */
  rerouteMeridian: boolean;
  /** 0..1 share of the mode-switch cost premium passed through to the customer */
  passThrough: number;
  /** who the pass-through clause applies to */
  passScope: "meridian" | "energy";
  /** divert / claim held shipments after this many days (null = keep waiting) */
  holdCap: number | null;
}

export const LEVERS_NONE: Levers = { reroute: 0, rerouteMeridian: false, passThrough: 0, passScope: "meridian", holdCap: null };
export const SCENARIOS: { id: string; name: string; blurb: string; levers: Levers }[] = [
  { id: "none", name: "Current playbook", blurb: "No changes — the baseline.", levers: LEVERS_NONE },
  { id: "cautious", name: "Cautious", blurb: "Move half the non-Meridian Pipeline volume, 25% pass-through for Meridian, cap holds at 40 days.", levers: { reroute: 0.5, rerouteMeridian: false, passThrough: 0.25, passScope: "meridian", holdCap: 40 } },
  { id: "plan", name: "Our plan", blurb: "Reroute all non-Meridian Pipeline volume, 50% pass-through for Meridian, divert or claim after 30 days.", levers: { reroute: 1, rerouteMeridian: false, passThrough: 0.5, passScope: "meridian", holdCap: 30 } },
  { id: "bold", name: "Aggressive", blurb: "Reroute everything off Pipeline, index all energy contracts at 75%, cap holds at 20 days.", levers: { reroute: 1, rerouteMeridian: true, passThrough: 0.75, passScope: "energy", holdCap: 20 } },
];

export interface SimResult {
  baseline: number;
  reroute: number;
  passThrough: number;
  holds: number;
  projected: number;
  recovered: number;
  byCustomer: { customer: string; before: number; after: number }[];
  rerouteCount: number;
  holdCount: number;
}

export function simulate(rows: readonly Shipment[], L: Levers): SimResult {
  const baseline = sum(rows, (r) => r.margin);
  let reroute = 0, passThrough = 0, holds = 0, rerouteCount = 0, holdCount = 0;
  const gain = new Map<string, number>();
  const add = (c: string, v: number) => gain.set(c, (gain.get(c) || 0) + v);

  for (const r of rows) {
    if (!isEnergy(r)) {
      if (r.route === HELD && L.holdCap !== null && r.delay > L.holdCap) {
        const saved = (r.ins + r.pen) * ((r.delay - L.holdCap) / r.delay);
        holds += saved; holdCount++; add(r.customer, saved);
      }
      continue;
    }
    let cost = r.cost;
    // lever 1: reroute Pipeline -> Cape at Cape's average cost per ton for the same product
    if (r.route === "Pipeline Bypass" && (L.rerouteMeridian || r.customer !== MERIDIAN) && L.reroute > 0) {
      const capeCost = r.tons * (CAPE_CPT[r.product] ?? r.cost / r.tons);
      const saved = Math.max(0, r.cost - capeCost) * L.reroute;
      if (saved > 0) { reroute += saved; rerouteCount++; add(r.customer, saved); cost -= saved; }
    }
    // lever 2: pass the premium over the pre-blockade Direct cost through to the customer
    const inScope = L.passScope === "energy" || r.customer === MERIDIAN;
    if (inScope && L.passThrough > 0 && (r.route === "Pipeline Bypass" || r.route === "Cape of Good Hope")) {
      const directCost = r.tons * (DIRECT_CPT[r.product] ?? 0);
      const extra = Math.max(0, cost - directCost) * L.passThrough;
      passThrough += extra; add(r.customer, extra);
    }
    // lever 3: stop paying waiting costs (insurance + penalties) after the cap
    if (r.route === HELD && L.holdCap !== null && r.delay > L.holdCap) {
      const saved = (r.ins + r.pen) * ((r.delay - L.holdCap) / r.delay);
      holds += saved; holdCount++; add(r.customer, saved);
    }
  }

  const byCustomer = byCustomerStats(rows).map((c) => ({
    customer: c.key, before: c.margin, after: c.margin + (gain.get(c.key) || 0),
  }));
  const recovered = reroute + passThrough + holds;
  return { baseline, reroute, passThrough, holds, projected: baseline + recovered, recovered, byCustomer, rerouteCount, holdCount };
}

const byCustomerStats = byCustomer;

/* ---------------- plan triggers ---------------- */

export type TriggerState = "firing" | "watch" | "clear";

export interface Trigger {
  id: string;
  action: "Protect" | "Renegotiate" | "Reroute" | "Triage" | "Restrict" | "Diversify";
  what: string;
  owner: string;
  when: string;
  rule: string;
  state: TriggerState;
  reading: string;
  detail: string;
}

export function evaluateTriggers(all: readonly Shipment[] = SHIPMENTS): Trigger[] {
  const container = all.filter((s) => !isEnergy(s));
  const overland = all.filter((s) => s.route === "Overland Truck");
  const overlandMargin = sum(overland, (s) => s.margin);
  const overlandDifot = overland.filter((s) => s.difot).length / (overland.length || 1);

  const mer = all
    .filter((s) => s.customer === MERIDIAN && s.route !== HELD && s.route !== "Direct (Pre-Blockade)")
    .sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0, best = 0;
  for (const s of mer) {
    streak = s.cost / s.tons > 2.5 * (s.rev / s.tons) ? streak + 1 : 0;
    best = Math.max(best, streak);
  }
  const merRatio = sum(mer, (s) => s.cost) / sum(mer, (s) => s.rev);

  const pb = all.filter((s) => s.route === "Pipeline Bypass");
  const pbRatio = Math.max(...PRODUCTS.filter((p) => ENERGY.has(p)).map((p) => {
    const list = pb.filter((s) => s.product === p);
    return list.length ? costPerTon(list) / (CAPE_CPT[p] || 1) : 0;
  }));

  const held = all.filter((s) => s.route === HELD);
  const heldFlags = held.filter((s) => s.delay > 30 || s.value > 15e6);

  const air = all.filter((s) => s.route === "Air Bridge");
  const airLoss = -sum(air, (s) => s.margin);
  const lateCont = container.filter((s) => !s.difot && s.route !== HELD);
  const avgPenalty = avg(lateCont, (s) => s.pen);
  const penaltyAvoided = avgPenalty * air.length;

  const energyRev = sum(all.filter(isEnergy), (s) => s.rev);
  const merShare = sum(all.filter((s) => isEnergy(s) && s.customer === MERIDIAN), (s) => s.rev) / energyRev;

  return [
    {
      id: "protect", action: "Protect", what: "Keep Overland Truck as the default alternate mode for containerized cargo.",
      owner: "Network Ops", when: "Immediate", rule: "Overland loss > $1M or on-time rate < 95%",
      state: -overlandMargin > 1e6 || overlandDifot < 0.95 ? "firing" : overlandMargin < 0 || overlandDifot < 0.98 ? "watch" : "clear",
      reading: `${money(overlandMargin, { sign: "plus" })} margin · ${pct(overlandDifot)} on time`,
      detail: "Overland Truck already works: it breaks even and delivers on time. Protect it while this stays clear.",
    },
    {
      id: "renegotiate", action: "Renegotiate", what: "Reopen Meridian's contract: index freight to route cost or add a war-risk pass-through clause.",
      owner: "Key Accounts", when: "Next 30 days", rule: "Cost/ton > 2.5× revenue/ton for 2 shipments in a row",
      state: best >= 2 ? "firing" : best === 1 ? "watch" : "clear",
      reading: `${best} in a row · cost ${times(merRatio)} revenue`,
      detail: "Every disrupted Meridian shipment costs more than twice what the contract pays.",
    },
    {
      id: "reroute", action: "Reroute", what: "Move non-Meridian energy volume off Pipeline Bypass onto Cape of Good Hope.",
      owner: "Network Planning", when: "Next 60 days", rule: "Pipeline cost/ton > 2× Cape, same cargo",
      state: pbRatio > 2 ? "firing" : pbRatio > 1.5 ? "watch" : "clear",
      reading: `Pipeline at ${times(pbRatio)} Cape cost/ton`,
      detail: "Pipeline Bypass is an emergency valve, not a default route.",
    },
    {
      id: "triage", action: "Triage", what: "Rank held shipments by cargo value × customer criticality; divert or claim instead of waiting.",
      owner: "Crisis Response Team", when: "Immediate", rule: "Held > 30 days, or cargo value > $15M",
      state: heldFlags.length ? "firing" : "clear",
      reading: `${heldFlags.length} of ${held.length} held shipments flagged`,
      detail: `${money(sum(heldFlags, (s) => s.value))} of cargo value sits in flagged shipments.`,
    },
    {
      id: "restrict", action: "Restrict", what: "Limit Air Bridge to contractually critical cargo — not a blanket fallback.",
      owner: "Ops Planning", when: "Next planning cycle", rule: "Air loss > late-delivery penalties it avoids",
      state: airLoss > penaltyAvoided ? "firing" : "clear",
      reading: `${money(airLoss, { sign: false })} loss vs ${money(penaltyAvoided, { sign: false })} penalties avoided`,
      detail: "Estimated penalties avoided = average penalty on late containerized shipments × Air Bridge shipments.",
    },
    {
      id: "diversify", action: "Diversify", what: "Cap single-customer concentration on energy lanes; qualify a second counterparty.",
      owner: "Strategy & Commercial", when: "Next contract cycle", rule: "One account > 30% of energy revenue",
      state: merShare > 0.3 ? "firing" : merShare > 0.2 ? "watch" : "clear",
      reading: `Meridian = ${pct(merShare)} of energy revenue`,
      detail: "One account holds most of the energy book and most of the loss.",
    },
  ];
}

/* ---------------- insights ---------------- */

export interface Insight {
  big: string;
  text: string;
  tone: "loss" | "warn" | "gain" | "neutral";
}

export function insightsFor(rows: readonly Shipment[]): Insight[] {
  const t = totals(rows);
  if (!t.n) return [{ big: "–", text: "No shipments match these filters. Reset them to see the full portfolio.", tone: "neutral" }];
  if (t.margin >= 0) {
    return [{ big: money(t.margin, { sign: "plus" }), text: "This slice is profitable. The losses sit in cargo and routes outside it.", tone: "gain" }];
  }
  const out: Insight[] = [];
  const b = buckets(rows).filter((x) => x.margin < 0).sort((a, c) => a.margin - c.margin)[0];
  out.push({ big: pct(b.margin / t.margin), text: `of the loss in this view comes from ${b.label.toLowerCase()} — ${int(b.n)} shipments, ${money(b.margin)}.`, tone: "loss" });

  const cs = byCustomer(rows);
  if (cs.length > 1 && cs[0].margin < 0) {
    out.push({ big: pct(cs[0].margin / t.margin), text: `comes from a single account: ${cs[0].key} (${money(cs[0].margin)}).`, tone: "loss" });
  } else if (t.held) {
    out.push({ big: money(t.heldValue), text: `of cargo is stuck in the Gulf across ${t.held} shipments, with no revenue recognized yet.`, tone: "warn" });
  }

  const worst = byRoute(rows).sort((a, c) => a.margin - c.margin)[0];
  if (worst && worst.margin < 0) {
    out.push(worst.key === HELD
      ? { big: money(worst.margin), text: "is the cost already paid on Held in Gulf shipments, where revenue can't be recognized until delivery.", tone: "warn" }
      : { big: times(worst.cost / worst.rev), text: `is how much ${worst.key} costs relative to what its contracts pay (${money(worst.margin)} in this view).`, tone: "loss" });
  }
  return out;
}
