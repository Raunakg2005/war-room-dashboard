"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SHIPMENTS, type Shipment } from "@/lib/data";
import { applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/analytics";

interface FilterCtx {
  filters: Filters;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  toggleFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  reset: () => void;
  rows: Shipment[];
  activeCount: number;
}

const FilterContext = createContext<FilterCtx | null>(null);

interface ThemeCtx {
  theme: "dark" | "light";
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function Providers({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    try {
      const saved = sessionStorage.getItem("wr-filters");
      if (saved) setFilters({ ...EMPTY_FILTERS, ...JSON.parse(saved) });
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem("wr-filters", JSON.stringify(filters));
    } catch {
      /* storage unavailable */
    }
  }, [filters]);

  const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
  }, []);
  const toggleFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: f[key] === value ? "" : value }));
  }, []);
  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const rows = useMemo(() => applyFilters(SHIPMENTS, filters), [filters]);
  const activeCount = Object.values(filters).filter(Boolean).length;

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("wr-theme", next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const filterValue = useMemo(
    () => ({ filters, setFilter, toggleFilter, reset, rows, activeCount }),
    [filters, setFilter, toggleFilter, reset, rows, activeCount],
  );
  const themeValue = useMemo(() => ({ theme, toggle }), [theme, toggle]);

  return (
    <ThemeContext.Provider value={themeValue}>
      <FilterContext.Provider value={filterValue}>{children}</FilterContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used inside <Providers>");
  return ctx;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <Providers>");
  return ctx;
}

/** Chart animation is off for users (and screenshot tools) that prefer reduced motion. */
export function useAnimate() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setOk(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return ok;
}

/** Resolved chart colours for the current theme. */
export function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const dark = theme === "dark";
    return {
      ink: dark ? "#f2efe8" : "#161a22",
      ink2: dark ? "#c3ccd8" : "#444c5a",
      ink3: dark ? "#7f8a9b" : "#7b8391",
      grid: dark ? "#1f2936" : "#e6e1d8",
      panel: dark ? "#131a24" : "#ffffff",
      line: dark ? "#2e3a4b" : "#d3ccbf",
      gold: dark ? "#e3a045" : "#b3690f",
      loss: dark ? "#ff8676" : "#c2392d",
      gain: dark ? "#7fdca6" : "#237a4b",
      sky: dark ? "#72a6ea" : "#2f6fb8",
      violet: dark ? "#a68cff" : "#7a5fd0",
      slate: dark ? "#56627a" : "#9aa2b0",
    };
  }, [theme]);
}
