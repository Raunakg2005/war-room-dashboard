"use client";

import type { ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { useAnimate, useChartColors } from "./providers";
import { Empty } from "./ui";
import { money, pct, int } from "@/lib/analytics";

type Colors = ReturnType<typeof useChartColors>;

/* ---------------- bar value label ---------------- */

interface BarValueProps {
  x?: number | string; y?: number | string; width?: number | string; height?: number | string;
  value?: unknown; text: string; c: Colors;
  /** Left edge of the plot area; outside labels never cross it. */
  minX?: number;
}

/** Horizontal-bar value label: inside the bar when it fits, otherwise just past the bar's outer end. */
export function BarValue({ x, y, width, height, value, text, c, minX = 0 }: BarValueProps) {
  const x0 = Number(x), w0 = Number(width), yy = Number(y) + Number(height) / 2;
  if (!Number.isFinite(x0) || !Number.isFinite(w0)) return null;
  const left = Math.min(x0, x0 + w0);
  const w = Math.abs(w0);
  const neg = Number(value) < 0;
  const tw = text.length * 6.6;
  const fits = w >= tw + 14;
  // A small negative bar with no room on its left gets its label past the zero line instead.
  const flip = !fits && neg && left - 6 - tw < minX;
  const props = fits
    ? { x: neg ? left + 7 : left + w - 7, anchor: (neg ? "start" : "end") as "start" | "end", fill: c.panel }
    : { x: neg && !flip ? left - 6 : left + w + 6, anchor: (neg && !flip ? "end" : "start") as "start" | "end", fill: c.ink2 };
  return (
    <text x={props.x} y={yy} dy="0.35em" textAnchor={props.anchor} fill={props.fill} fontSize={11} fontWeight={600} className="tabular">
      {text}
    </text>
  );
}

/* ---------------- tooltip ---------------- */

export interface TipRow { label: string; value: string; color?: string }

interface TipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  build: (datum: never) => { title: string; rows: TipRow[]; foot?: string } | null;
}

function Tip({ active, payload, build }: TipProps) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const out = build(payload[0].payload as never);
  if (!out) return null;
  return (
    <div className="min-w-44 rounded-xl border border-line bg-panel/95 px-3 py-2.5 text-[12px] shadow-xl backdrop-blur">
      <p className="mb-1.5 font-semibold text-ink">{out.title}</p>
      <ul className="space-y-1">
        {out.rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-3">
              {r.color && <span className="size-2 rounded-sm" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="tabular font-medium text-ink">{r.value}</span>
          </li>
        ))}
      </ul>
      {out.foot && <p className="mt-2 border-t border-line pt-1.5 text-[11px] text-ink-3">{out.foot}</p>}
    </div>
  );
}

const axisTick = (c: Colors, size = 11) => ({ fill: c.ink3, fontSize: size });
const catTick = (c: Colors, size = 12) => ({ fill: c.ink2, fontSize: size });

export function ChartBox({ height = 300, children, empty }: { height?: number; children: ReactNode; empty?: boolean }) {
  return (
    <div style={{ height }} className="w-full px-2 pb-3 pt-2 sm:px-3">
      {empty ? <Empty /> : children}
    </div>
  );
}

/* ---------------- signed horizontal bars ---------------- */

/** Leave room past the longest bar on either side so value labels never collide with row names. */
export const PADDED: [(v: number) => number, (v: number) => number] = [
  (min) => (min < 0 ? min * 1.32 : 0),
  (max) => (max > 0 ? max * 1.32 : 0),
];

export interface SignedDatum {
  key: string;
  value: number;
  n?: number;
  color?: string;
  sub?: string;
}

export function SignedBars({
  data, height = 300, onSelect, selected, valueLabel = "Gross margin", format = (v: number) => money(v), labelWidth = 150, showLabels = true,
}: {
  data: SignedDatum[];
  height?: number;
  onSelect?: (key: string) => void;
  selected?: string;
  valueLabel?: string;
  format?: (v: number) => string;
  labelWidth?: number;
  showLabels?: boolean;
}) {
  const c = useChartColors();
  const anim = useAnimate();
  const empty = !data.some((d) => d.value !== 0);
  return (
    <ChartBox height={height} empty={empty}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 4 }} barCategoryGap="22%">
          <CartesianGrid horizontal={false} stroke={c.grid} />
          <XAxis type="number" domain={PADDED} tick={axisTick(c)} tickFormatter={(v) => money(v, { digits: 0 })} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="key" width={labelWidth} tick={catTick(c)} axisLine={false} tickLine={false} interval={0} />
          <ReferenceLine x={0} stroke={c.line} />
          <Tooltip
            cursor={{ fill: c.grid, opacity: 0.5 }}
            content={(p) => (
              <Tip {...p} build={(d: SignedDatum) => ({
                title: d.key,
                rows: [
                  { label: valueLabel, value: format(d.value) },
                  ...(d.n !== undefined ? [{ label: "Shipments", value: int(d.n) }] : []),
                ],
                foot: d.sub ?? (onSelect ? "Click to filter the dashboard" : undefined),
              })} />
            )}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 4, 4]}
            maxBarSize={30}
            cursor={onSelect ? "pointer" : undefined}
            onClick={onSelect ? (d) => onSelect((d.payload as SignedDatum).key) : undefined}
            isAnimationActive={anim} animationDuration={500}
          >
            {data.map((d) => (
              <Cell
                key={d.key}
                fill={d.color ?? (d.value < 0 ? c.loss : c.gain)}
                fillOpacity={selected && selected !== d.key ? 0.3 : 1}
              />
            ))}
            {showLabels && (
              <LabelList dataKey="value" content={(p) => <BarValue {...p} text={money(Number(p.value))} c={c} minX={4 + labelWidth} />} />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- waterfall: revenue -> costs -> margin ---------------- */

export function Waterfall({ revenue, freight, fuel, ins, pen, height = 300 }: { revenue: number; freight: number; fuel: number; ins: number; pen: number; height?: number }) {
  const c = useChartColors();
  const anim = useAnimate();
  const steps = [
    { key: "Revenue", delta: revenue, kind: "total" as const },
    { key: "Freight", delta: -freight, kind: "step" as const },
    { key: "Fuel", delta: -fuel, kind: "step" as const },
    { key: "Insurance", delta: -ins, kind: "step" as const },
    { key: "Penalties", delta: -pen, kind: "step" as const },
  ];
  let run = 0;
  const data = steps.map((s) => {
    const start = s.kind === "total" ? 0 : run;
    run = s.kind === "total" ? s.delta : run + s.delta;
    const lo = Math.min(start, run), hi = Math.max(start, run);
    return { key: s.key, base: lo, size: hi - lo, delta: s.delta, color: s.kind === "total" ? c.sky : c.loss };
  });
  const end = run;
  data.push({ key: "Margin", base: Math.min(0, end), size: Math.abs(end), delta: end, color: end < 0 ? c.loss : c.gain });
  const empty = revenue === 0 && freight === 0;
  return (
    <ChartBox height={height} empty={empty}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 22, right: 12, bottom: 4, left: 4 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="key" tick={catTick(c, 11)} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={axisTick(c)} tickFormatter={(v) => money(v, { digits: 0 })} axisLine={false} tickLine={false} width={64} />
          <ReferenceLine y={0} stroke={c.line} />
          <Tooltip
            cursor={{ fill: c.grid, opacity: 0.4 }}
            content={(p) => <Tip {...p} build={(d: { key: string; delta: number }) => ({ title: d.key, rows: [{ label: "Amount", value: money(d.delta, { sign: "plus" }) }] })} />}
          />
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="size" stackId="w" radius={[4, 4, 4, 4]} isAnimationActive={anim} animationDuration={600}>
            {data.map((d) => <Cell key={d.key} fill={d.color} />)}
            <LabelList dataKey="delta" position="top" formatter={(v: unknown) => money(Number(v), { sign: "plus" })} style={{ fill: c.ink2, fontSize: 11, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- weekly stacked ---------------- */

export function WeeklyStack({ data, series, height = 320 }: { data: Record<string, number | string>[]; series: { key: string; color: string }[]; height?: number }) {
  const c = useChartColors();
  const anim = useAnimate();
  return (
    <ChartBox height={height} empty={!data.length}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }} stackOffset="sign">
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" tick={catTick(c, 11)} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick(c)} tickFormatter={(v) => `${v < 0 ? "−" : ""}$${Math.abs(v)}M`} axisLine={false} tickLine={false} width={56} />
          <ReferenceLine y={0} stroke={c.line} />
          <ReferenceLine x="2 Feb" stroke={c.gold} strokeDasharray="4 4" label={{ value: "Blockade", position: "insideTopLeft", fill: c.gold, fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: c.grid, opacity: 0.4 }}
            content={(p) => (
              <Tip {...p} build={(d: Record<string, number | string>) => ({
                title: `Week of ${d.label}`,
                rows: series.filter((s) => d[s.key]).map((s) => ({ label: s.key, value: money(Number(d[s.key]) * 1e6), color: s.color })),
                foot: `Week total ${money(Number(d.total))}`,
              })} />
            )}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} stackId="r" fill={s.color} maxBarSize={44} isAnimationActive={anim} animationDuration={500} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- cost vs revenue per ton ---------------- */

export function PerTon({ data, height = 300 }: { data: { key: string; cost: number; rev: number; n: number }[]; height?: number }) {
  const c = useChartColors();
  const anim = useAnimate();
  return (
    <ChartBox height={height} empty={!data.length}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 22, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="key" tick={catTick(c, 11)} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={axisTick(c)} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            cursor={{ fill: c.grid, opacity: 0.4 }}
            content={(p) => (
              <Tip {...p} build={(d: { key: string; cost: number; rev: number; n: number }) => ({
                title: d.key,
                rows: [
                  { label: "Cost per ton", value: `$${d.cost.toFixed(2)}`, color: c.loss },
                  { label: "Revenue per ton", value: `$${d.rev.toFixed(2)}`, color: c.gold },
                  { label: "Cost ÷ revenue", value: `${(d.cost / d.rev).toFixed(1)}×` },
                ],
                foot: `${d.n} energy shipments`,
              })} />
            )}
          />
          <Bar dataKey="cost" radius={[6, 6, 0, 0]} maxBarSize={64} isAnimationActive={anim} animationDuration={600}>
            {data.map((d) => <Cell key={d.key} fill={d.key.startsWith("Direct") ? c.slate : c.loss} />)}
            <LabelList
              dataKey="cost"
              content={(p) => {
                const d = data[Number(p.index)];
                if (!d) return null;
                // When the revenue dot sits just above a short bar, put the label inside the bar instead.
                const inside = d.cost < d.rev * 1.4 && Number(p.height) > 28;
                const x = Number(p.x) + Number(p.width) / 2;
                const y = inside ? Number(p.y) + 16 : Number(p.y) - 8;
                return (
                  <text x={x} y={y} textAnchor="middle" fill={inside ? c.ink : c.ink2} fontSize={11} fontWeight={600}>
                    ${d.cost.toFixed(1)}
                  </text>
                );
              }}
            />
          </Bar>
          <Line dataKey="rev" stroke={c.gold} strokeWidth={3} dot={{ r: 5, fill: c.gold, strokeWidth: 0 }} activeDot={{ r: 7 }} type="linear" isAnimationActive={anim} animationDuration={600} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- 100% stacked cost mix ---------------- */

export function CostMix({ data, height = 300 }: { data: { key: string; freight: number; fuel: number; ins: number; pen: number }[]; height?: number }) {
  const c = useChartColors();
  const anim = useAnimate();
  const parts = [
    { key: "freight", label: "Freight", color: c.sky },
    { key: "fuel", label: "Fuel", color: c.slate },
    { key: "ins", label: "War-risk insurance", color: c.gold },
    { key: "pen", label: "Late penalties", color: c.loss },
  ] as const;
  const rows = data.map((d) => {
    const t = d.freight + d.fuel + d.ins + d.pen || 1;
    return { key: d.key, freight: d.freight / t, fuel: d.fuel / t, ins: d.ins / t, pen: d.pen / t };
  });
  return (
    <ChartBox height={height} empty={!data.length}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barCategoryGap="26%">
          <CartesianGrid horizontal={false} stroke={c.grid} />
          <XAxis type="number" domain={[0, 1]} tick={axisTick(c)} tickFormatter={(v) => pct(v)} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="key" width={132} tick={catTick(c)} axisLine={false} tickLine={false} interval={0} />
          <Tooltip
            cursor={{ fill: c.grid, opacity: 0.4 }}
            content={(p) => (
              <Tip {...p} build={(d: (typeof rows)[number]) => ({
                title: d.key,
                rows: parts.map((x) => ({ label: x.label, value: pct(d[x.key], 1), color: x.color })),
              })} />
            )}
          />
          {parts.map((x, i) => (
            <Bar key={x.key} dataKey={x.key} stackId="m" fill={x.color} radius={i === 0 ? [4, 0, 0, 4] : i === parts.length - 1 ? [0, 4, 4, 0] : 0} isAnimationActive={anim} animationDuration={500} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- service vs economics bubble ---------------- */

export function ServiceBubbles({ data, height = 320, onSelect }: { data: { key: string; label: string; difot: number; marginPerRev: number; n: number; margin: number; color: string }[]; height?: number; onSelect?: (k: string) => void }) {
  const c = useChartColors();
  const anim = useAnimate();
  // Points that land on top of each other share one label.
  const points = data.map((d) => ({ ...d, tag: d.label }));
  points.forEach((d, i) => {
    points.slice(0, i).forEach((o) => {
      if (o.tag && Math.abs(o.difot - d.difot) < 0.06 && Math.abs(o.marginPerRev - d.marginPerRev) < 0.25) {
        o.tag = `${o.tag} · ${d.tag}`;
        d.tag = "";
      }
    });
  });
  return (
    <ChartBox height={height} empty={!data.length}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 4 }}>
          <CartesianGrid stroke={c.grid} />
          <XAxis type="number" dataKey="difot" domain={[-0.05, 1.05]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => pct(v)} tick={axisTick(c)} axisLine={false} tickLine={false}
            label={{ value: "Delivered on time, in full", position: "insideBottom", offset: -8, fill: c.ink3, fontSize: 11 }} />
          <YAxis type="number" dataKey="marginPerRev" tickFormatter={(v) => pct(v)} tick={axisTick(c)} axisLine={false} tickLine={false} width={56}
            label={{ value: "Margin ÷ revenue", angle: -90, position: "insideLeft", fill: c.ink3, fontSize: 11, dy: 40 }} />
          <ZAxis type="number" dataKey="n" range={[120, 1400]} />
          <ReferenceLine y={0} stroke={c.line} />
          <Tooltip
            cursor={false}
            content={(p) => (
              <Tip {...p} build={(d: (typeof data)[number]) => ({
                title: d.key,
                rows: [
                  { label: "On time, in full", value: pct(d.difot) },
                  { label: "Margin ÷ contracted revenue", value: pct(d.marginPerRev) },
                  { label: "Gross margin", value: money(d.margin) },
                  { label: "Shipments", value: int(d.n) },
                ],
                foot: onSelect ? "Click to filter the dashboard" : undefined,
              })} />
            )}
          />
          <Scatter isAnimationActive={anim} data={points} cursor={onSelect ? "pointer" : undefined} onClick={onSelect ? (d) => onSelect((d as unknown as { key: string }).key) : undefined}>
            {data.map((d) => <Cell key={d.key} fill={d.color} fillOpacity={0.75} stroke={d.color} />)}
            <LabelList dataKey="tag" position="top" offset={12} style={{ fill: c.ink2, fontSize: 11, fontWeight: 600 }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- simple vertical bars ---------------- */

export function ColumnBars({ data, height = 260, format = (v: number) => int(v), valueLabel = "Shipments" }: { data: { key: string; value: number; color: string }[]; height?: number; format?: (v: number) => string; valueLabel?: string }) {
  const c = useChartColors();
  const anim = useAnimate();
  return (
    <ChartBox height={height} empty={!data.some((d) => d.value)}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="key" tick={catTick(c, 11)} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={axisTick(c)} tickFormatter={format} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
          <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} content={(p) => <Tip {...p} build={(d: { key: string; value: number }) => ({ title: d.key, rows: [{ label: valueLabel, value: format(d.value) }] })} />} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={anim} animationDuration={500}>
            {data.map((d) => <Cell key={d.key} fill={d.color} />)}
            <LabelList dataKey="value" position="top" formatter={(v: unknown) => format(Number(v))} style={{ fill: c.ink2, fontSize: 11, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}
