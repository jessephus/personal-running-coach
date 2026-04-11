"use client";

import { useState, useMemo, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSort, faSortUp, faSortDown } from "@fortawesome/free-solid-svg-icons";

export type Column<T> = {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
};

export function DataTable<T extends object>({
  columns,
  rows,
  defaultSort,
}: {
  columns: Column<T>[];
  rows: T[];
  defaultSort?: { key: keyof T & string; dir: "asc" | "desc" };
}) {
  const [sortKey, setSortKey] = useState<(keyof T & string) | null>(
    defaultSort?.key ?? null,
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    defaultSort?.dir ?? "desc",
  );

  const handleSort = useCallback(
    (key: keyof T & string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey],
  );

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  return (
    <div
      className="overflow-x-auto rounded-xl border"
      style={{ borderColor: "var(--border)" }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "var(--bg-secondary)" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${col.sortable !== false ? "cursor-pointer select-none" : ""}`}
                style={{ color: "var(--text-secondary)" }}
                onClick={
                  col.sortable !== false
                    ? () => handleSort(col.key)
                    : undefined
                }
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable !== false && (
                    <FontAwesomeIcon
                      icon={
                        sortKey === col.key
                          ? sortDir === "asc"
                            ? faSortUp
                            : faSortDown
                          : faSort
                      }
                      className="h-3 w-3"
                      style={{
                        opacity: sortKey === col.key ? 1 : 0.3,
                      }}
                    />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              className="border-t"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-card)",
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-4 py-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  {col.render
                    ? col.render((row as Record<string, unknown>)[col.key], row)
                    : String((row as Record<string, unknown>)[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
