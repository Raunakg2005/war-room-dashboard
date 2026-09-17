"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import clsx from "clsx";

export const cx = clsx;

export function useAnimatedNumber(target: number, duration = 700) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduce) {
      setValue(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(a + (target - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, duration, reduce]);
  return value;
}

export function AnimatedValue({ value, format }: { value: number; format: (v: number) => string }) {
  const v = useAnimatedNumber(value);
  return <>{format(v)}</>;
}

export function Card({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "article" | "div" }) {
  return (
    <As className={cx("min-w-0 rounded-2xl border border-line bg-panel shadow-glow", className)}>
      {children}
    </As>
  );
}

export function CardHeader({ title, sub, right, className }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
        {sub && <p className="mt-1 text-[13px] leading-snug text-ink-3">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-gold", className)}>{children}</p>;
}

export function PageHeader({ eyebrow, title, lede, right }: { eyebrow: string; title: ReactNode; lede?: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-2 font-serif text-3xl font-bold leading-tight tracking-tight text-ink sm:text-[2.35rem]">{title}</h1>
        {lede && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{lede}</p>}
      </div>
      {right}
    </header>
  );
}

type Tone = "loss" | "gain" | "warn" | "neutral" | "info";

const toneText: Record<Tone, string> = {
  loss: "text-loss",
  gain: "text-gain",
  warn: "text-gold",
  neutral: "text-ink",
  info: "text-sky",
};

export function KpiCard({
  label, value, format, note, tone = "neutral", icon, delay = 0,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  note?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="relative overflow-hidden rounded-2xl border border-line bg-panel p-4 shadow-glow sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-ink-3">{label}</span>
        {icon && <span className="text-ink-3 [&>svg]:size-4">{icon}</span>}
      </div>
      <div className={cx("tabular mt-2 truncate font-serif text-[26px] font-bold leading-none sm:text-[28px] xl:text-[24px] 2xl:text-[28px]", toneText[tone])}>
        <AnimatedValue value={value} format={format} />
      </div>
      {note && <div className="mt-2 text-[12px] leading-snug text-ink-2">{note}</div>}
    </motion.div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  const map: Record<Tone, string> = {
    loss: "bg-loss-soft text-loss",
    gain: "bg-gain-soft text-gain",
    warn: "bg-gold-soft text-gold",
    neutral: "bg-panel-2 text-ink-2 border border-line",
    info: "bg-sky/10 text-sky",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", map[tone], className)}>
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-panel-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
            value === o.value ? "bg-panel text-ink shadow-sm" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children = "No shipments match these filters." }: { children?: ReactNode }) {
  return <div className="grid h-full min-h-40 place-items-center text-sm text-ink-3">{children}</div>;
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={i.dashed ? { border: `2px dashed ${i.color}` } : { background: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
