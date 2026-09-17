"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cx } from "./ui";

export interface Column<T> {
  key: string;
  header: string;
  value: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  sortable?: boolean;
}

export function DataTable<T>({
  rows, columns, initialSort, rowKey, onRowClick, isActive, pageSize, empty = "No rows match these filters.", dense,
}: {
  rows: readonly T[];
  columns: Column<T>[];
  initialSort?: { key: string; dir: 1 | -1 };
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  isActive?: (row: T) => boolean;
  pageSize?: number;
  empty?: string;
  dense?: boolean;
}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return [...rows];
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return [...rows];
    return [...rows].sort((a, b) => {
      const x = col.value(a), y = col.value(b);
      if (x === null) return 1;
      if (y === null) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * sort.dir;
      return String(x).localeCompare(String(y)) * sort.dir;
    });
  }, [rows, columns, sort]);

  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = pageSize ? sorted.slice(current * pageSize, (current + 1) * pageSize) : sorted;

  const toggle = (key: string) => {
    setPage(0);
    setSort((s) => (s?.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));
  };

  return (
    <div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const Icon = !active ? ArrowUpDown : sort!.dir === 1 ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}
                    className={cx(
                      "whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3",
                      c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                    )}
                  >
                    {c.sortable === false ? c.header : (
                      <button type="button" onClick={() => toggle(c.key)} className={cx("inline-flex items-center gap-1 uppercase hover:text-ink", active && "text-ink")}>
                        {c.header}
                        <Icon className={cx("size-3", !active && "opacity-40")} />
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cx(
                  "border-b border-line/70 transition-colors last:border-0",
                  onRowClick && "cursor-pointer hover:bg-panel-2",
                  isActive?.(r) && "bg-gold-soft",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      "whitespace-nowrap px-3 text-ink-2",
                      dense ? "py-2" : "py-2.5",
                      c.align === "right" ? "tabular text-right" : c.align === "center" ? "text-center" : "text-left",
                      c.className,
                    )}
                  >
                    {c.render ? c.render(r) : c.value(r)}
                  </td>
                ))}
              </tr>
            ))}
            {!visible.length && (
              <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-ink-3">{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {pageSize && pages > 1 && (
        <div className="flex items-center justify-between gap-3 px-3 pt-3 text-[12.5px] text-ink-3">
          <span className="tabular">{current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length}</span>
          <div className="flex gap-2">
            <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink-2 enabled:hover:text-ink disabled:opacity-40">Previous</button>
            <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink-2 enabled:hover:text-ink disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
