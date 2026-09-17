"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity, Database, FlaskConical, Gauge, Menu, Moon, Play, Route as RouteIcon,
  SlidersHorizontal, Sun, Timer, Users, X, ListChecks, Microscope, Hourglass,
  type LucideIcon,
} from "lucide-react";
import { useFilters, useTheme } from "./providers";
import { CUSTOMERS, PRODUCTS, REGIONS, ROUTES } from "@/lib/data";
import { describeFilters, EMPTY_FILTERS, type Filters } from "@/lib/analytics";
import { cx } from "./ui";

const NAV: { href: string; label: string; icon: LucideIcon; tag?: string }[] = [
  { href: "/", label: "Command center", icon: Gauge },
  { href: "/routes", label: "Route economics", icon: RouteIcon },
  { href: "/customers", label: "Customer exposure", icon: Users },
  { href: "/held", label: "Held in Gulf", icon: Timer },
  { href: "/deep-dives", label: "Deep dives", icon: Microscope },
  { href: "/simulator", label: "What-if simulator", icon: FlaskConical },
  { href: "/stress-test", label: "Stress test", icon: Hourglass },
  { href: "/plan", label: "Action plan", icon: ListChecks },
  { href: "/data", label: "Data & method", icon: Database },
];

function isActive(pathname: string, href: string) {
  const p = pathname.replace(/\/$/, "") || "/";
  return href === "/" ? p === "/" : p === href || p.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-1.5">
      <span className="relative grid size-9 place-items-center rounded-xl bg-gold-soft text-gold">
        <Activity className="size-5" />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-loss ring-2 ring-panel" />
      </span>
      <span className="leading-tight">
        <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">War Room</span>
        <span className="block font-serif text-[17px] font-bold text-ink">Strait Outta Hormuz</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon, tag }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
              active ? "bg-gold-soft text-gold" : "text-ink-2 hover:bg-panel-2 hover:text-ink",
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            <span className="truncate">{label}</span>
            {tag && <span className="ml-auto rounded-md bg-gold px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-bg">{tag}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function StoryButton({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  return (
    <Link
      href="/story"
      onClick={onNavigate}
      className={cx(
        "flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-[14px] font-semibold text-bg transition hover:brightness-110",
        className,
      )}
    >
      <Play className="size-4 fill-current" /> Present the story
    </Link>
  );
}

const SELECT_ARROW =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a93a3' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

function Select<K extends keyof Filters>({ k, label, options }: { k: K; label: string; options: { value: string; label: string }[] }) {
  const { filters, setFilter } = useFilters();
  const value = filters[k] as string;
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</span>
      <select
        value={value}
        style={{ backgroundImage: SELECT_ARROW, backgroundPosition: "right 12px center", backgroundRepeat: "no-repeat" }}
        onChange={(e) => setFilter(k, e.target.value as Filters[K])}
        className={cx(
          "w-full cursor-pointer appearance-none truncate rounded-xl border bg-panel px-3 py-2 pr-8 text-[13.5px] text-ink outline-none transition",
          value ? "border-gold" : "border-line hover:border-line-2",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function FilterFields() {
  return (
    <>
      <Select k="group" label="Cargo group" options={[
        { value: "", label: "All cargo" },
        { value: "energy", label: "Energy (crude & refined)" },
        { value: "container", label: "Containerized" },
      ]} />
      <Select k="route" label="Route" options={[{ value: "", label: "All routes" }, ...ROUTES.map((r) => ({ value: r, label: r }))]} />
      <Select k="product" label="Product" options={[{ value: "", label: "All products" }, ...PRODUCTS.map((r) => ({ value: r, label: r }))]} />
      <Select k="customer" label="Customer" options={[{ value: "", label: "All customers" }, ...CUSTOMERS.map((r) => ({ value: r, label: r }))]} />
      <Select k="region" label="Region" options={[{ value: "", label: "All regions" }, ...REGIONS.map((r) => ({ value: r, label: r }))]} />
    </>
  );
}

function FilterChips() {
  const { filters, setFilter, reset, rows, activeCount } = useFilters();
  const keys = (Object.keys(filters) as (keyof Filters)[]).filter((k) => filters[k]);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="tabular text-[12.5px] text-ink-3">
        {activeCount ? `${rows.length} of 243 shipments` : "All 243 shipments"}
      </span>
      {keys.map((k) => {
        const text = describeFilters({ ...EMPTY_FILTERS, [k]: filters[k] } as Filters)[0];
        return (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k, "" as Filters[typeof k])}
            className="group flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft py-1 pl-3 pr-2 text-[12px] font-medium text-gold"
            aria-label={`Remove filter: ${text}`}
          >
            {text}
            <X className="size-3.5 opacity-70 group-hover:opacity-100" />
          </button>
        );
      })}
      {activeCount > 1 && (
        <button type="button" onClick={reset} className="text-[12px] font-medium text-ink-3 underline-offset-4 hover:text-ink hover:underline">
          Clear all
        </button>
      )}
    </div>
  );
}

function FilterPanel() {
  const [open, setOpen] = useState(false);
  const { activeCount, reset } = useFilters();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cx(
          "flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium transition",
          open || activeCount ? "border-gold/50 bg-gold-soft text-gold" : "border-line bg-panel text-ink-2 hover:text-ink",
        )}
      >
        <SlidersHorizontal className="size-4" />
        <span className="hidden sm:inline">Filters</span>
        {activeCount > 0 && <span className="rounded-full bg-gold px-1.5 text-[11px] font-bold text-bg">{activeCount}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-40 mt-2 w-[min(92vw,380px)] rounded-2xl border border-line bg-panel p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink">Filter every view</p>
              <button type="button" onClick={reset} className="text-[12px] text-ink-3 hover:text-ink">Reset</button>
            </div>
            <div className="grid gap-3">
              <FilterFields />
            </div>
            <p className="mt-3 text-[11.5px] leading-snug text-ink-3">Tip: click any bar in a chart to filter by it.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="grid size-9 place-items-center rounded-xl border border-line bg-panel text-ink-2 transition hover:text-ink"
    >
      {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const bare = /\/story\/?$/.test(pathname);
  useEffect(() => setMenu(false), [pathname]);

  if (bare) return <>{children}</>;

  return (
    <div className="relative min-h-screen">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] opacity-70" />

      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg-2/80 p-4 backdrop-blur-xl lg:flex">
        <Brand />
        <div className="mt-6 flex-1">
          <p className="mb-2 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">Analysis</p>
          <NavLinks />
        </div>
        <div className="space-y-3">
          <p className="px-3 text-[11.5px] leading-snug text-ink-3">243 shipments · 5 Jan – 22 Mar 2026 · all values USD</p>
          <StoryButton />
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setMenu(true)}
              className="grid size-9 place-items-center rounded-xl border border-line bg-panel text-ink-2 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </button>
            <div className="lg:hidden"><span className="font-serif text-[16px] font-bold">Strait Outta Hormuz</span></div>
            <div className="hidden min-w-0 flex-1 lg:block"><FilterChips /></div>
            <div className="ml-auto flex items-center gap-2">
              <FilterPanel />
              <ThemeToggle />
            </div>
          </div>
          <div className="border-t border-line px-4 py-2 lg:hidden"><FilterChips /></div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8">{children}</main>
        <footer className="mx-auto max-w-[1400px] px-6 pb-8 text-[12px] text-ink-3">
          War Room Masterplan · Source: Shipment_Data (243 rows), cleaned as described in Data &amp; method.
        </footer>
      </div>

      <AnimatePresence>
        {menu && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMenu(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-xs flex-col border-r border-line bg-panel p-4 lg:hidden"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              role="dialog" aria-label="Menu"
            >
              <div className="flex items-center justify-between">
                <Brand />
                <button type="button" onClick={() => setMenu(false)} aria-label="Close menu" className="grid size-9 place-items-center rounded-xl text-ink-2">
                  <X className="size-5" />
                </button>
              </div>
              <div className="mt-6 flex-1"><NavLinks onNavigate={() => setMenu(false)} /></div>
              <StoryButton onNavigate={() => setMenu(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
