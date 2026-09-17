"use client";

import { Fragment, useMemo } from "react";
import { motion } from "motion/react";
import { useChartColors, useFilters } from "./providers";
import { cx } from "./ui";
import { ROUTES, SHORT_ROUTE, type Route, type Shipment } from "@/lib/data";
import { byRoute, money, pct, statsBy, sum, type GroupStat } from "@/lib/analytics";

/* ======================================================================
   Corridor map — schematic of the six ways cargo moved
   ====================================================================== */

const ORIGIN = { x: 96, y: 236 };
const DEST = { x: 904, y: 236 };

const LANES: Record<Route, { d: string; chip: { x: number; y: number }; note: string }> = {
  "Air Bridge": {
    d: `M${ORIGIN.x},${ORIGIN.y} C200,236 250,44 500,44 C750,44 800,236 ${DEST.x},${DEST.y}`,
    chip: { x: 500, y: 44 }, note: "Emergency air freight",
  },
  "Overland Truck": {
    d: `M${ORIGIN.x},${ORIGIN.y} C170,236 200,112 300,112 L720,112 C820,112 830,236 ${DEST.x},${DEST.y}`,
    chip: { x: 510, y: 112 }, note: "Road corridor, containers only",
  },
  "Pipeline Bypass": {
    d: `M${ORIGIN.x},${ORIGIN.y} C180,236 210,174 310,174 L720,174 C810,174 820,236 ${DEST.x},${DEST.y}`,
    chip: { x: 510, y: 174 }, note: "Overland pipeline to a Red Sea port",
  },
  "Direct (Pre-Blockade)": {
    d: `M${ORIGIN.x},${ORIGIN.y} L${DEST.x},${DEST.y}`,
    chip: { x: 510, y: 236 }, note: "Through the strait — closed from Feb",
  },
  "Cape of Good Hope": {
    d: `M${ORIGIN.x},${ORIGIN.y} C190,236 210,370 320,384 C470,404 610,410 730,376 C830,348 836,236 ${DEST.x},${DEST.y}`,
    chip: { x: 520, y: 402 }, note: "Around Africa — weeks longer",
  },
  "Held in Gulf": {
    d: `M${ORIGIN.x},${ORIGIN.y} C150,236 170,318 214,330`,
    chip: { x: 160, y: 422 }, note: "Anchored, undelivered",
  },
};

function laneColor(route: Route, c: ReturnType<typeof useChartColors>) {
  switch (route) {
    case "Direct (Pre-Blockade)": return c.gain;
    case "Cape of Good Hope": return c.sky;
    case "Pipeline Bypass": return c.loss;
    case "Held in Gulf": return c.gold;
    case "Overland Truck": return c.gain;
    case "Air Bridge": return c.violet;
  }
}

export function CorridorMap({ rows }: { rows: readonly Shipment[] }) {
  const c = useChartColors();
  const { filters, toggleFilter } = useFilters();
  const stats = useMemo(() => new Map(byRoute(rows).map((s) => [s.key as Route, s])), [rows]);
  const maxN = Math.max(1, ...[...stats.values()].map((s) => s.n));

  return (
    <div>
      {/* Desktop / tablet: schematic */}
      <div className="hidden md:block">
        <svg viewBox="0 0 1000 450" className="h-auto w-full select-none" role="img" aria-label="Schematic map of the six routes cargo took around the Strait of Hormuz, with shipments, gross margin and on-time delivery for each.">
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c.loss} stopOpacity="0.45" />
              <stop offset="100%" stopColor={c.loss} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* chokepoint landmasses */}
          <path d="M214,120 C236,150 238,196 246,226 L262,226 C268,190 276,150 300,122 Z" fill={c.grid} />
          <path d="M214,352 C236,322 238,276 246,246 L262,246 C268,282 276,322 300,350 Z" fill={c.grid} />
          <text x="272" y="268" fill={c.ink3} fontSize="10" fontWeight={600} letterSpacing="1.5">STRAIT OF HORMUZ</text>

          {ROUTES.map((r) => {
            const s = stats.get(r);
            const lane = LANES[r];
            const col = laneColor(r, c);
            const active = !filters.route || filters.route === r;
            const w = s ? 2.5 + (s.n / maxN) * 9 : 1.5;
            const isDirect = r === "Direct (Pre-Blockade)";
            const isHeld = r === "Held in Gulf";
            return (
              <g
                key={r}
                role="button"
                tabIndex={0}
                aria-label={`${r}: ${s ? `${s.n} shipments, ${money(s.margin)}` : "no shipments in view"}. Click to filter.`}
                aria-pressed={filters.route === r}
                onClick={() => toggleFilter("route", r)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleFilter("route", r))}
                className="cursor-pointer outline-none [&:focus-visible_.chip]:stroke-[var(--gold)]"
                style={{ opacity: active ? 1 : 0.22, transition: "opacity .25s" }}
              >
                <path d={lane.d} fill="none" stroke={col} strokeOpacity={0.18} strokeWidth={w + 8} strokeLinecap="round" />
                <path d={lane.d} fill="none" stroke={col} strokeOpacity={0.55} strokeWidth={w} strokeLinecap="round" />
                {s && !isDirect && !isHeld && (
                  <path d={lane.d} fill="none" stroke={c.ink} strokeOpacity={0.55} strokeWidth={Math.max(1.5, w / 3)} strokeLinecap="round"
                    className={cx("flow-dash", r === "Cape of Good Hope" && "flow-slow")} />
                )}
                {isHeld && s && (
                  <g>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <circle key={i} cx={226 + (i % 3) * 16} cy={322 + Math.floor(i / 3) * 16} r="5" fill={col} />
                    ))}
                    <circle cx="242" cy="330" r="26" fill="none" stroke={col} strokeWidth="1.5" className="pulse-ring" />
                  </g>
                )}
                <LaneChip x={lane.chip.x} y={lane.chip.y} title={r} stat={s} color={col} note={lane.note} />
              </g>
            );
          })}

          {/* blockade marker on the direct lane */}
          <circle cx="254" cy="236" r="34" fill="url(#glow)" />
          <circle cx="254" cy="236" r="14" fill={c.panel} stroke={c.loss} strokeWidth="2" />
          <path d="M248,230 L260,242 M260,230 L248,242" stroke={c.loss} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="254" cy="236" r="20" fill="none" stroke={c.loss} strokeWidth="1.5" className="pulse-ring" />

          {/* origin + destination */}
          <g>
            <circle cx={ORIGIN.x} cy={ORIGIN.y} r="30" fill={c.panel} stroke={c.line} strokeWidth="1.5" />
            <text x={ORIGIN.x} y={ORIGIN.y - 2} textAnchor="middle" fill={c.ink} fontSize="12" fontWeight={700}>Gulf</text>
            <text x={ORIGIN.x} y={ORIGIN.y + 12} textAnchor="middle" fill={c.ink3} fontSize="10">ports</text>
          </g>
          <g>
            <rect x={DEST.x - 6} y={DEST.y - 44} width="86" height="88" rx="16" fill={c.panel} stroke={c.line} strokeWidth="1.5" />
            <text x={DEST.x + 37} y={DEST.y - 14} textAnchor="middle" fill={c.ink} fontSize="12" fontWeight={700}>Customers</text>
            <text x={DEST.x + 37} y={DEST.y + 4} textAnchor="middle" fill={c.ink3} fontSize="10">Europe · Asia</text>
            <text x={DEST.x + 37} y={DEST.y + 18} textAnchor="middle" fill={c.ink3} fontSize="10">Americas</text>
            <text x={DEST.x + 37} y={DEST.y + 32} textAnchor="middle" fill={c.ink3} fontSize="10">Middle East</text>
          </g>
        </svg>
      </div>

      {/* Mobile: lane list */}
      <ul className="grid gap-2 md:hidden">
        {ROUTES.map((r) => {
          const s = stats.get(r);
          const col = laneColor(r, c);
          const on = filters.route === r;
          return (
            <li key={r}>
              <button
                type="button"
                onClick={() => toggleFilter("route", r)}
                aria-pressed={on}
                className={cx("flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left", on ? "border-gold bg-gold-soft" : "border-line bg-panel-2")}
              >
                <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: col }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{r}</span>
                  <span className="block text-[11.5px] text-ink-3">{LANES[r].note}</span>
                </span>
                <span className="text-right">
                  <span className={cx("tabular block text-[13px] font-semibold", s && s.margin < 0 ? "text-loss" : "text-gain")}>{s ? money(s.margin) : "–"}</span>
                  <span className="tabular block text-[11px] text-ink-3">{s ? `${s.n} · ${pct(s.onTime / s.n)} on time` : "no shipments"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LaneChip({ x, y, title, stat, color, note }: { x: number; y: number; title: Route; stat?: GroupStat; color: string; note: string }) {
  const c = useChartColors();
  const w = 236, h = 44;
  const m = stat?.margin ?? 0;
  return (
    <g transform={`translate(${x - w / 2}, ${y - h / 2})`}>
      <title>{note}</title>
      <rect className="chip" width={w} height={h} rx="11" fill={c.panel} stroke={c.line} strokeWidth="1.5" />
      <rect x="10" y="12" width="4" height="20" rx="2" fill={color} />
      <text x="22" y="19" fill={c.ink} fontSize="12" fontWeight={700}>{SHORT_ROUTE[title] === "Direct" ? "Direct (pre-blockade)" : title}</text>
      <text x="22" y="34" fill={c.ink3} fontSize="10.5">
        {stat ? (
          <>
            <tspan>{stat.n} shipments · </tspan>
            <tspan fill={m < 0 ? c.loss : c.gain} fontWeight={700}>{money(m, { sign: "plus" })}</tspan>
            <tspan>{` · ${pct(stat.onTime / stat.n)} on time`}</tspan>
          </>
        ) : "No shipments in this view"}
      </text>
    </g>
  );
}

/* ======================================================================
   Rank shift — margin % rank vs dollar-loss rank
   ====================================================================== */

export function RankShift({ rows }: { rows: readonly Shipment[] }) {
  const c = useChartColors();
  const items = useMemo(() => {
    const g = statsBy(rows, (r) => r.product);
    return g.map((x) => ({
      key: x.key,
      pctLoss: -sum(x.rows, (r) => r.margin / r.rev) / x.rows.length,
      loss: -x.margin,
      energy: x.key === "Crude Oil" || x.key === "Refined Petrochemicals",
    }));
  }, [rows]);
  if (!items.length) return <p className="py-10 text-center text-sm text-ink-3">No shipments match these filters.</p>;
  const left = [...items].sort((a, b) => b.pctLoss - a.pctLoss);
  const right = [...items].sort((a, b) => b.loss - a.loss);
  const rowH = 46, top = 46, H = top + items.length * rowH;
  const yL = (k: string) => top + left.findIndex((x) => x.key === k) * rowH + rowH / 2;
  const yR = (k: string) => top + right.findIndex((x) => x.key === k) * rowH + rowH / 2;
  const colorOf = (energy: boolean) => (energy ? c.loss : c.gold);

  return (
    <svg viewBox={`0 0 640 ${H + 8}`} className="h-auto w-full" role="img" aria-label="Products ranked by average margin loss percent on the left and by dollars lost on the right, with lines showing how each product's rank changes.">
      <text x="200" y="22" textAnchor="end" fill={c.ink3} fontSize="11" fontWeight={700} letterSpacing="1.2">WORST MARGIN %</text>
      <text x="440" y="22" fill={c.ink3} fontSize="11" fontWeight={700} letterSpacing="1.2">MOST DOLLARS LOST</text>
      {items.map((it, i) => {
        const y1 = yL(it.key), y2 = yR(it.key);
        const moved = Math.abs(left.indexOf(left.find((x) => x.key === it.key)!) - right.indexOf(right.find((x) => x.key === it.key)!));
        return (
          <motion.path
            key={it.key}
            d={`M222,${y1} C320,${y1} 320,${y2} 418,${y2}`}
            fill="none"
            stroke={colorOf(it.energy)}
            strokeWidth={moved ? 2.5 : 1.5}
            strokeOpacity={moved ? 0.9 : 0.45}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: i * 0.05 }}
          />
        );
      })}
      {left.map((it) => (
        <g key={`l-${it.key}`}>
          <circle cx="222" cy={yL(it.key)} r="6" fill={colorOf(it.energy)} />
          <text x="206" y={yL(it.key) - 3} textAnchor="end" fill={c.ink} fontSize="12.5" fontWeight={600}>{it.key}</text>
          <text x="206" y={yL(it.key) + 12} textAnchor="end" fill={c.ink3} fontSize="11">{`${pct(it.pctLoss)} of revenue lost`}</text>
        </g>
      ))}
      {right.map((it) => (
        <g key={`r-${it.key}`}>
          <circle cx="418" cy={yR(it.key)} r="6" fill={colorOf(it.energy)} />
          <text x="434" y={yR(it.key) - 3} fill={c.ink} fontSize="12.5" fontWeight={600}>{it.key}</text>
          <text x="434" y={yR(it.key) + 12} fill={it.loss > 0 ? c.loss : c.gain} fontSize="11" fontWeight={600}>{money(-it.loss)}</text>
        </g>
      ))}
    </svg>
  );
}

/* ======================================================================
   Heatmap — customer x route
   ====================================================================== */

export function ExposureHeatmap({ rows }: { rows: readonly Shipment[] }) {
  const c = useChartColors();
  const { filters, setFilter } = useFilters();
  const { customers, routes, cells, max } = useMemo(() => {
    const customers = statsBy(rows, (r) => r.customer).sort((a, b) => a.margin - b.margin).map((x) => x.key);
    const routes = ROUTES.filter((r) => rows.some((x) => x.route === r));
    const cells = new Map<string, { m: number; n: number }>();
    for (const r of rows) {
      const k = `${r.customer}|${r.route}`;
      const cell = cells.get(k) ?? { m: 0, n: 0 };
      cell.m += r.margin;
      cell.n += 1;
      cells.set(k, cell);
    }
    const max = Math.max(1, ...[...cells.values()].map((v) => Math.abs(v.m)));
    return { customers, routes, cells, max };
  }, [rows]);

  if (!customers.length) return <p className="py-10 text-center text-sm text-ink-3">No shipments match these filters.</p>;

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <div className="grid min-w-[680px] gap-1" style={{ gridTemplateColumns: `minmax(170px,1.4fr) repeat(${routes.length}, minmax(76px,1fr))` }}>
        <div />
        {routes.map((r) => (
          <div key={r} className="px-1 pb-1 text-center text-[11px] font-semibold text-ink-3">{SHORT_ROUTE[r]}</div>
        ))}
        {customers.map((cu) => (
          <Fragment key={cu}>
            <div className="truncate py-1.5 pr-2 text-[12.5px] font-medium text-ink-2" title={cu}>{cu}</div>
            {routes.map((r) => {
              const cell = cells.get(`${cu}|${r}`);
              if (!cell) return <div key={r} className="rounded-md bg-panel-2/60" />;
              const intensity = Math.sqrt(Math.abs(cell.m) / max);
              const base = cell.m < 0 ? c.loss : c.gain;
              const on = filters.customer === cu && filters.route === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setFilter("customer", on ? "" : cu);
                    setFilter("route", on ? "" : r);
                  }}
                  title={`${cu} · ${r}: ${money(cell.m)} across ${cell.n} shipments`}
                  className={cx("tabular rounded-md px-1 py-1.5 text-center text-[11px] font-semibold transition hover:ring-2 hover:ring-gold/60", on && "ring-2 ring-gold")}
                  style={{
                    background: `color-mix(in srgb, ${base} ${Math.round(12 + intensity * 78)}%, transparent)`,
                    color: intensity > 0.45 ? "#fff" : c.ink,
                  }}
                >
                  {money(cell.m, { digits: Math.abs(cell.m) >= 1e6 ? 1 : 0 })}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
