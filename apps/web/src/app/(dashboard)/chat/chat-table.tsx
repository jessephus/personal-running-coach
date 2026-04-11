"use client";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { ChatRow } from "@/lib/page-data";

const columns: Column<ChatRow>[] = [
  {
    key: "sentAt",
    label: "Time",
    render: (v) => {
      const d = new Date(v as string);
      return d.toLocaleString();
    },
  },
  {
    key: "direction",
    label: "Direction",
    render: (v) => (
      <StatusBadge
        label={v as string}
        tone={v === "inbound" ? "accent" : v === "outbound" ? "success" : "neutral"}
      />
    ),
  },
  {
    key: "channel",
    label: "Channel",
    render: (v) => <span className="capitalize">{v as string}</span>,
  },
  {
    key: "bodyPreview",
    label: "Message",
    sortable: false,
    render: (v) => (
      <span className="line-clamp-2 max-w-md">{v as string}</span>
    ),
  },
];

export function ChatTable({ rows }: { rows: ChatRow[] }) {
  return (
    <DataTable<ChatRow>
      columns={columns}
      rows={rows}
      defaultSort={{ key: "sentAt", dir: "desc" }}
    />
  );
}
