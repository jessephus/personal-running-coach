"use client";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { TrainingRow } from "@/lib/page-data";

const effortTone = (v: number) =>
  v >= 8 ? "danger" : v >= 6 ? "warning" : "success";

const columns: Column<TrainingRow>[] = [
  { key: "date", label: "Date" },
  {
    key: "type",
    label: "Type",
    render: (v) => <span className="capitalize">{v as string}</span>,
  },
  {
    key: "distanceKm",
    label: "Distance (km)",
    render: (v) => `${Number(v).toFixed(1)}`,
  },
  {
    key: "durationMinutes",
    label: "Duration (min)",
  },
  {
    key: "perceivedEffort",
    label: "Effort",
    render: (v) => (
      <StatusBadge label={`${v}/10`} tone={effortTone(v as number)} />
    ),
  },
  {
    key: "summary",
    label: "Summary",
    sortable: false,
    render: (v) => (
      <span className="line-clamp-2 max-w-xs">{v as string}</span>
    ),
  },
];

export function TrainingTable({ rows }: { rows: TrainingRow[] }) {
  return (
    <DataTable<TrainingRow>
      columns={columns}
      rows={rows}
      defaultSort={{ key: "date", dir: "desc" }}
    />
  );
}
