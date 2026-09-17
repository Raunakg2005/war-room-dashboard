"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend as RLegend, Line, LineChart, ReferenceDot,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { useAnimate, useChartColors } from "./providers";
import { BarValue, ChartBox, PADDED } from "./charts";
import { money, pct } from "@/lib/analytics";
import type { costBridge, pareto, penaltyRule, stressTest, tenure } from "@/lib/deep";

type C = ReturnType<typeof useChartColors>;
const tick = (c: C, s = 11) => ({ fill: c.ink3, fontSize: s });

function Box({ children }: { children: React.ReactNode }) {
  return <div className="min-w-44 rounded-xl border border-line bg-panel/95 px-3 py-2.5 text-[12px] shadow-xl backdrop-blur">{children}</div>;
}
function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <p className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-ink-3">{color && <span className="size-2 rounded-sm" style={{ background: color }} />}{k}</span>
      <span className="tabular font-medium text-ink">{v}</span>
    </p>
  );
}
type TipArgs = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> };
const datum = <T,>(p: TipArgs) => (p.active && p.payload?.length ? (p.payload[0].payload as T) : null);

/* ---------------- Pareto ---------------- */

export function ParetoCurve({ data, height = 320 }: { data: ReturnType<typeof pareto>; height?: number }) {
  const c = useChartColors();
  const anim = useAnimate();
  const marks = [data.p50, data.p80].filter(Boolean) as { count: number; share: number }[];
  return (
    <ChartBox height={height} empty={!data.lossMakers}>
      <ResponsiveContainer>
        <AreaChart data={data.points} margin={{ top: 16, right: 20, bottom: 18, left: 0 }}>
          <defs>
            <linearGradient id="pareto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.loss} stopOpacity={0.35} />
              <stop offset="100%" stopColor={c.loss} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.grid} />
          <XAxis type="number" dataKey="x" domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tickFormatter={(v) => pct(v)} tick={tick(c)} axisLine={false} tickLine={false}
            label={{ value: "Share of shipments (biggest losses first)", position: "insideBottom", offset: -10, fill: c.ink3, fontSize: 11 }} />
          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => pct(v)} tick={tick(c)} axisLine={false} tickLine={false} width={48} />
          <ReferenceLine y={0.5} stroke={c.line} strokeDasharray="4 4" />
          <ReferenceLine y={0.8} stroke={c.line} strokeDasharray="4 4" />
          <Tooltip cursor={{ stroke: c.line }} content={(p) => {
            const d = datum<(typeof data.points)[number]>(p);
            if (!d || !d.id) return null;
            return (
              <Box>
                <p className="mb-1 font-semibold text-ink">{d.id} · {d.customer}</p>
                <Row k="This shipment" v={money(d.margin)} />
                <Row k="Route" v={d.route} />
                <Row k="Cumulative share of loss" v={pct(d.y, 1)} />
                <Row k="Share of shipments" v={pct(d.x, 1)} />
              </Box>
            );
          }} />
          <Area type="stepAfter" dataKey="y" stroke={c.loss} strokeWidth={2.5} fill="url(#pareto)" isAnimationActive={anim} animationDuration={700} />
          {marks.map((m) => (
            <ReferenceDot key={m.share} x={m.share} y={data.points[m.count].y} r={6} fill={c.gold} stroke={c.panel} strokeWidth={2}
              label={{ value: `${m.count} shipments → ${pct(data.points[m.count].y)}`, position: "right", fill: c.ink, fontSize: 11, fontWeight: 600 }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- Cost bridge ---------------- */

export function CostBridgeChart({ data, height = 320 }: { data: ReturnType<typeof costBridge>; height?: number }) {
  const c = useChartColors();
  const anim = useAnimate();
  const colors = { freight: c.sky, fuel: c.slate, ins: c.gold, pen: c.loss };
  const rows = [
    { key: "Pre-blockade baseline", freight: data.base.freight, fuel: data.base.fuel, ins: data.base.ins, pen: data.base.pen, total: data.baseTotal, rev: data.base.rev },
    ...data.routes.map((r) => ({ key: r.route, freight: r.p.freight, fuel: r.p.fuel, ins: r.p.ins, pen: r.p.pen, total: r.total, rev: r.p.rev })),
  ];
  return (
    <ChartBox height={height} empty={!data.routes.length}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 22, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="key" tick={{ fill: c.ink2, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={tick(c)} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} width={44} />
          <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} content={(p) => {
            const d = datum<(typeof rows)[number]>(p);
            if (!d) return null;
            return (
              <Box>
                <p className="mb-1 font-semibold text-ink">{d.key}</p>
                <Row k="Freight" v={`$${d.freight.toFixed(2)}/t`} color={colors.freight} />
                <Row k="Fuel" v={`$${d.fuel.toFixed(2)}/t`} color={colors.fuel} />
                <Row k="War-risk insurance" v={`$${d.ins.toFixed(2)}/t`} color={colors.ins} />
                <Row k="Late penalties" v={`$${d.pen.toFixed(2)}/t`} color={colors.pen} />
                <p className="mt-1.5 border-t border-line pt-1.5"><Row k="Total vs revenue" v={`$${d.total.toFixed(2)} vs $${d.rev.toFixed(2)}`} /></p>
              </Box>
            );
          }} />
          <ReferenceLine y={data.base.rev} stroke={c.gold} strokeDasharray="5 4" label={{ value: `Contract pays ~$${data.base.rev.toFixed(1)}/t`, position: "insideTopRight", fill: c.gold, fontSize: 11 }} />
          {(["freight", "fuel", "ins", "pen"] as const).map((k, i) => (
            <Bar key={k} dataKey={k} stackId="s" fill={colors[k]} maxBarSize={72} radius={i === 3 ? [5, 5, 0, 0] : 0} isAnimationActive={anim} animationDuration={600}>
              {i === 3 && <LabelList dataKey="total" position="top" formatter={(v: unknown) => `$${Number(v).toFixed(1)}`} style={{ fill: c.ink2, fontSize: 11, fontWeight: 600 }} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- Break-even ---------------- */

export function BreakEvenChart({ data, height = 320 }: { data: { key: string; uplift: number; n: number; gap: number }[]; height?: number }) {
  const c = useChartColors();
  const anim = useAnimate();
  return (
    <ChartBox height={height} empty={!data.length}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }} barCategoryGap="24%">
          <CartesianGrid horizontal={false} stroke={c.grid} />
          <XAxis type="number" domain={PADDED} tickFormatter={(v) => pct(v)} tick={tick(c)} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="key" width={210} tick={{ fill: c.ink2, fontSize: 11.5 }} axisLine={false} tickLine={false} interval={0} />
          <ReferenceLine x={0} stroke={c.line} />
          <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} content={(p) => {
            const d = datum<(typeof data)[number]>(p);
            if (!d) return null;
            return (
              <Box>
                <p className="mb-1 font-semibold text-ink">{d.key}</p>
                <Row k="Rate change to break even" v={pct(d.uplift)} />
                <Row k={d.gap > 0 ? "Revenue shortfall" : "Current surplus"} v={money(Math.abs(d.gap), { sign: false })} />
                <Row k="Shipments" v={String(d.n)} />
              </Box>
            );
          }} />
          <Bar dataKey="uplift" radius={4} maxBarSize={26} isAnimationActive={anim} animationDuration={600}>
            {data.map((d) => <Cell key={d.key} fill={d.uplift > 1 ? c.loss : d.uplift > 0 ? c.gold : c.gain} />)}
            <LabelList dataKey="uplift" content={(p) => <BarValue {...p} text={(Number(p.value) > 0 ? "+" : "") + pct(Number(p.value))} c={c} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- Penalty rule ---------------- */

export function PenaltyScatter({ data, height = 320 }: { data: ReturnType<typeof penaltyRule>; height?: number }) {
  const c = useChartColors();
  const anim = useAnimate();
  const maxD = Math.max(1, ...data.delivered.map((p) => p.x));
  const maxH = Math.max(1, ...data.held.map((p) => p.x));
  return (
    <ChartBox height={height} empty={!data.lateCount}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 12, right: 20, bottom: 18, left: 4 }}>
          <CartesianGrid stroke={c.grid} />
          <XAxis type="number" dataKey="x" scale="sqrt" tick={tick(c)} tickFormatter={(v) => `${v}`} axisLine={false} tickLine={false}
            label={{ value: "Cargo value × days late ($M·days, √ scale)", position: "insideBottom", offset: -10, fill: c.ink3, fontSize: 11 }} />
          <YAxis type="number" dataKey="y" scale="sqrt" tick={tick(c)} tickFormatter={(v) => `$${v}M`} axisLine={false} tickLine={false} width={52} />
          <ZAxis range={[36, 36]} />
          <Tooltip cursor={false} content={(p) => {
            const d = datum<(typeof data.delivered)[number]>(p);
            if (!d) return null;
            return (
              <Box>
                <p className="mb-1 font-semibold text-ink">{d.id} · {d.route}</p>
                <Row k="Days late" v={String(d.delay)} />
                <Row k="Penalty" v={money(d.y * 1e6)} />
                <Row k="Penalty ÷ (value × days)" v={pct(d.y / d.x, 2)} />
              </Box>
            );
          }} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxD, y: maxD * data.deliveredRate }]} stroke={c.sky} strokeDasharray="4 4" />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxH, y: maxH * data.heldRate }]} stroke={c.gold} strokeDasharray="4 4" />
          <Scatter isAnimationActive={anim} name={`Delivered late · ${pct(data.deliveredRate, 1)} per day`} data={data.delivered} fill={c.sky} fillOpacity={0.8} />
          <Scatter isAnimationActive={anim} name={`Held in Gulf · ${pct(data.heldRate, 1)} per day`} data={data.held} fill={c.gold} fillOpacity={0.85} />
          <RLegend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 12, color: c.ink2 }} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- Insurance clock ---------------- */

export function InsuranceClock({ data, height = 280 }: { data: { label: string; rate: number; n: number }[]; height?: number }) {
  const c = useChartColors();
  const anim = useAnimate();
  return (
    <ChartBox height={height} empty={!data.length}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 18, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" tick={{ fill: c.ink2, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => pct(v, 1)} tick={tick(c)} axisLine={false} tickLine={false} width={48} />
          <ReferenceLine x="2 Feb" stroke={c.loss} strokeDasharray="4 4" label={{ value: "Blockade", position: "insideTopLeft", fill: c.loss, fontSize: 11 }} />
          <Tooltip cursor={{ stroke: c.line }} content={(p) => {
            const d = datum<(typeof data)[number]>(p);
            if (!d) return null;
            return (
              <Box>
                <p className="mb-1 font-semibold text-ink">Week of {d.label}</p>
                <Row k="Insurance ÷ cargo value" v={pct(d.rate, 2)} />
                <Row k="Shipments departed" v={String(d.n)} />
              </Box>
            );
          }} />
          <Line type="monotone" dataKey="rate" stroke={c.gold} strokeWidth={3} dot={{ r: 4, fill: c.gold, strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={anim} animationDuration={700} />
        </LineChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- Tenure ---------------- */

export function TenureScatter({ data, height = 340, onSelect }: { data: ReturnType<typeof tenure>; height?: number; onSelect?: (customer: string) => void }) {
  const c = useChartColors();
  const anim = useAnimate();
  const energy = data.filter((d) => d.energy).map((d) => ({ ...d, y: d.margin / 1e6 }));
  const cont = data.filter((d) => !d.energy).map((d) => ({ ...d, y: d.margin / 1e6 }));
  const tip = (p: TipArgs) => {
    const d = datum<(typeof energy)[number]>(p);
    if (!d) return null;
    return (
      <Box>
        <p className="mb-1 font-semibold text-ink">{d.customer}</p>
        <Row k="Client since" v={`${d.since} (${d.years} yrs)`} />
        <Row k="Gross margin" v={money(d.margin)} />
        <Row k="Contracted revenue" v={money(d.rev)} />
        <Row k="Region" v={d.region} />
      </Box>
    );
  };
  return (
    <ChartBox height={height} empty={!data.length}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 12, right: 24, bottom: 18, left: 4 }}>
          <CartesianGrid stroke={c.grid} />
          <XAxis type="number" dataKey="years" domain={[3, 17]} tick={tick(c)} axisLine={false} tickLine={false}
            label={{ value: "Years as a client", position: "insideBottom", offset: -10, fill: c.ink3, fontSize: 11 }} />
          <YAxis type="number" dataKey="y" tick={tick(c)} tickFormatter={(v) => `${v < 0 ? "−" : ""}$${Math.abs(v)}M`} axisLine={false} tickLine={false} width={60} />
          <ZAxis type="number" dataKey="rev" range={[60, 1600]} />
          <ReferenceLine y={0} stroke={c.line} />
          <Tooltip cursor={false} content={tip} />
          <Scatter isAnimationActive={anim} name="Energy accounts" data={energy} fill={c.loss} fillOpacity={0.7} cursor={onSelect ? "pointer" : undefined}
            onClick={onSelect ? (d) => onSelect((d as unknown as { customer: string }).customer) : undefined} />
          <Scatter isAnimationActive={anim} name="Containerized accounts" data={cont} fill={c.sky} fillOpacity={0.7} cursor={onSelect ? "pointer" : undefined}
            onClick={onSelect ? (d) => onSelect((d as unknown as { customer: string }).customer) : undefined} />
          <RLegend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 12, color: c.ink2 }} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ---------------- Stress test ---------------- */

export function StressChart({ data, height = 340 }: { data: ReturnType<typeof stressTest>["series"]; height?: number }) {
  const c = useChartColors();
  const anim = useAnimate();
  return (
    <ChartBox height={height} empty={data.length < 2}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="stress-cur" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.loss} stopOpacity={0.02} />
              <stop offset="100%" stopColor={c.loss} stopOpacity={0.3} />
            </linearGradient>
            <linearGradient id="stress-plan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.gain} stopOpacity={0.02} />
              <stop offset="100%" stopColor={c.gain} stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" tick={{ fill: c.ink2, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={(v) => money(v, { digits: 0 })} tick={tick(c)} axisLine={false} tickLine={false} width={68} />
          <Tooltip cursor={{ stroke: c.line }} content={(p) => {
            const d = datum<(typeof data)[number]>(p);
            if (!d) return null;
            return (
              <Box>
                <p className="mb-1 font-semibold text-ink">{d.week ? `After ${d.week} more week${d.week === 1 ? "" : "s"}` : "Today"}</p>
                <Row k="Current playbook" v={money(d.current)} color={c.loss} />
                <Row k="With our plan" v={money(d.plan)} color={c.gain} />
                <Row k="Difference" v={money(d.plan - d.current, { sign: "plus" })} />
              </Box>
            );
          }} />
          <Area type="monotone" dataKey="current" name="Current playbook" stroke={c.loss} strokeWidth={2.5} fill="url(#stress-cur)" isAnimationActive={anim} animationDuration={500} />
          <Area type="monotone" dataKey="plan" name="With our plan" stroke={c.gain} strokeWidth={2.5} fill="url(#stress-plan)" isAnimationActive={anim} animationDuration={500} />
          <RLegend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12, color: c.ink2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}
