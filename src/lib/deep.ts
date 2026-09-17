import { HELD, ROUTES, SHIPMENTS, isEnergy, type Route, type Shipment } from "./data";
import { byCustomer, SCENARIOS, shortDate, simulate, statsBy, sum, weekStart } from "./analytics";

/* ======================================================================
   Pareto — how few shipments carry the loss
   ====================================================================== */

export function pareto(rows: readonly Shipment[]) {
  const losses = rows.filter((r) => r.margin < 0).sort((a, b) => a.margin - b.margin);
  const total = sum(losses, (r) => r.margin);
  const n = rows.length || 1;
  let cum = 0;
  const points: { x: number; y: number; id: string; margin: number; customer: string; route: string }[] = [
    { x: 0, y: 0, id: "", margin: 0, customer: "", route: "" },
  ];
  losses.forEach((r, i) => {
    cum += r.margin;
    points.push({ x: (i + 1) / n, y: total ? cum / total : 0, id: r.id, margin: r.margin, customer: r.customer, route: r.route });
  });
  const reach = (t: number) => {
    const i = points.findIndex((p) => p.y >= t - 1e-9 && p.id);
    return i < 0 ? null : { count: i, share: points[i].x };
  };
  return {
    points, totalLoss: total, lossMakers: losses.length, n: rows.length,
    p50: reach(0.5), p80: reach(0.8), p95: reach(0.95),
    top: losses.slice(0, 10),
  };
}

/* ======================================================================
   Cost bridge — energy cost per ton vs the pre-blockade baseline
   ====================================================================== */

export const COST_COMPONENTS = [
  { key: "freight", label: "Freight" },
  { key: "fuel", label: "Fuel" },
  { key: "ins", label: "War-risk insurance" },
  { key: "pen", label: "Late penalties" },
] as const;
export type CostKey = (typeof COST_COMPONENTS)[number]["key"];

interface PerTon { freight: number; fuel: number; ins: number; pen: number; rev: number }

function perTon(list: readonly Shipment[]): PerTon {
  const t = sum(list, (r) => r.tons) || 1;
  return {
    freight: sum(list, (r) => r.freight) / t,
    fuel: sum(list, (r) => r.fuel) / t,
    ins: sum(list, (r) => r.ins) / t,
    pen: sum(list, (r) => r.pen) / t,
    rev: sum(list, (r) => r.rev) / t,
  };
}

const costOf = (p: PerTon) => p.freight + p.fuel + p.ins + p.pen;

export function costBridge(rows: readonly Shipment[]) {
  const base = perTon(SHIPMENTS.filter((s) => isEnergy(s) && s.route === "Direct (Pre-Blockade)"));
  const routes = statsBy(rows.filter(isEnergy), (r) => r.route, ROUTES)
    .filter((g) => g.key !== "Direct (Pre-Blockade)")
    .map((g) => {
      const p = perTon(g.rows);
      const delta = { freight: p.freight - base.freight, fuel: p.fuel - base.fuel, ins: p.ins - base.ins, pen: p.pen - base.pen };
      const biggest = (Object.keys(delta) as CostKey[]).sort((a, b) => delta[b] - delta[a])[0];
      return { route: g.key as Route, n: g.n, tons: g.tons, p, total: costOf(p), delta, biggest, premium: (costOf(p) - costOf(base)) * g.tons };
    });
  return { base, baseTotal: costOf(base), routes };
}

/* ======================================================================
   Break-even pricing
   ====================================================================== */

export function breakEven(rows: readonly Shipment[]) {
  const out: { key: string; route: Route; group: "Energy" | "Containerized"; n: number; cost: number; rev: number; uplift: number; gap: number }[] = [];
  for (const route of ROUTES.filter((r) => r !== HELD)) {
    for (const group of ["Energy", "Containerized"] as const) {
      const list = rows.filter((r) => r.route === route && (group === "Energy") === isEnergy(r));
      if (!list.length) continue;
      const cost = sum(list, (r) => r.cost);
      const rev = sum(list, (r) => r.rev);
      out.push({ key: `${route} · ${group}`, route, group, n: list.length, cost, rev, uplift: cost / rev - 1, gap: cost - rev });
    }
  }
  return out.sort((a, b) => b.uplift - a.uplift);
}

/* ======================================================================
   Hidden rules — penalties and insurance
   ====================================================================== */

export function penaltyRule(rows: readonly Shipment[]) {
  const late = rows.filter((r) => r.delay > 0);
  const rate = (list: readonly Shipment[]) => (list.length ? sum(list, (r) => r.pen) / sum(list, (r) => r.value * r.delay) : 0);
  const heldLate = late.filter((r) => r.route === HELD);
  const deliveredLate = late.filter((r) => r.route !== HELD);
  const onTime = rows.filter((r) => r.delay === 0);
  return {
    delivered: deliveredLate.map((r) => ({ id: r.id, x: (r.value * r.delay) / 1e6, y: r.pen / 1e6, delay: r.delay, route: r.route })),
    held: heldLate.map((r) => ({ id: r.id, x: (r.value * r.delay) / 1e6, y: r.pen / 1e6, delay: r.delay, route: r.route })),
    deliveredRate: rate(deliveredLate),
    heldRate: rate(heldLate),
    onTimeCount: onTime.length,
    onTimeZero: onTime.every((r) => r.pen === 0),
    lateCount: late.length,
  };
}

export function insuranceClock(rows: readonly Shipment[]) {
  const weeks = [...new Set(rows.map((r) => weekStart(r.date)))].sort();
  return weeks.map((w) => {
    const list = rows.filter((r) => weekStart(r.date) === w);
    return { week: w, label: shortDate(w), rate: sum(list, (r) => r.ins) / (sum(list, (r) => r.value) || 1), n: list.length };
  });
}

/* ======================================================================
   Relationships and geography
   ====================================================================== */

export function tenure(rows: readonly Shipment[]) {
  return byCustomer(rows).map((g) => ({
    customer: g.key,
    since: g.rows[0].since,
    years: 2026 - g.rows[0].since,
    margin: g.margin,
    rev: g.rev,
    n: g.n,
    energy: g.rows.filter(isEnergy).length / g.n > 0.5,
    region: g.rows[0].region,
  }));
}

export const byRegion = (rows: readonly Shipment[]) => statsBy(rows, (r) => r.region).sort((a, b) => a.margin - b.margin);

/* ======================================================================
   Stress test — what if the blockade lasts longer?
   ====================================================================== */

const DAY = 864e5;
export const BLOCKADE_START = "2026-02-01";
export const DATA_END = "2026-03-22";
const BLOCKADE_WEEKS = ((Date.parse(DATA_END) - Date.parse(BLOCKADE_START)) / DAY + 1) / 7;

export function stressBaseline(all: readonly Shipment[] = SHIPMENTS) {
  const moving = all.filter((s) => s.route !== "Direct (Pre-Blockade)" && s.route !== HELD);
  const held = all.filter((s) => s.route === HELD);
  const levers = SCENARIOS.find((s) => s.id === "plan")!.levers;
  const planMoving = simulate(moving, { ...levers, holdCap: null });
  const planHeld = simulate(held, levers);

  const flowPerWeek = sum(moving, (s) => s.margin) / BLOCKADE_WEEKS;
  const heldFlowPerWeek = sum(held, (s) => s.margin) / BLOCKADE_WEEKS;
  const insPerWeek = sum(moving, (s) => s.ins) / BLOCKADE_WEEKS;
  const stockBurnPerDay = sum(held, (s) => (s.pen + s.ins) / Math.max(1, s.delay));

  const insRate = (m: string) => {
    const list = moving.filter((s) => s.date.startsWith(m));
    return sum(list, (s) => s.ins) / sum(list, (s) => s.value);
  };
  const monthlyInsGrowth = insRate("2026-03") / insRate("2026-02") - 1;

  return {
    weeks: BLOCKADE_WEEKS,
    flowPerWeek,
    planFlowPerWeek: planMoving.projected / BLOCKADE_WEEKS,
    heldFlowPerWeek,
    planHeldFlowPerWeek: planHeld.projected / BLOCKADE_WEEKS,
    insPerWeek,
    stockBurnPerDay,
    heldCount: held.length,
    heldValue: sum(held, (s) => s.value),
    monthlyInsGrowth,
    weeklyInsGrowth: monthlyInsGrowth * (12 / 52),
  };
}

export type StressBase = ReturnType<typeof stressBaseline>;

export function stressTest(weeks: number, escalate: boolean, base: StressBase) {
  const series: { week: number; label: string; current: number; plan: number }[] = [{ week: 0, label: "Now", current: 0, plan: 0 }];
  let cur = 0;
  let pl = 0;
  for (let w = 1; w <= weeks; w++) {
    const extraIns = escalate ? base.insPerWeek * base.weeklyInsGrowth * w : 0;
    cur += base.flowPerWeek + base.heldFlowPerWeek - base.stockBurnPerDay * 7 - extraIns;
    pl += base.planFlowPerWeek + base.planHeldFlowPerWeek - extraIns;
    series.push({ week: w, label: `W${w}`, current: cur, plan: pl });
  }
  return { series, current: cur, plan: pl, saved: pl - cur };
}
