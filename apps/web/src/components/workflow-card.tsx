import type { WorkflowResult } from "@coachinclaw/coach-core";
import { StatusBadge } from "./status-badge";

export function WorkflowCard({ workflow }: { workflow: WorkflowResult }) {
  const riskTone =
    workflow.risk === "high"
      ? "danger"
      : workflow.risk === "medium"
        ? "warning"
        : "success";

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-card)",
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            {workflow.workflow}
          </p>
          <p
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {workflow.headline}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <StatusBadge label={`${workflow.risk} risk`} tone={riskTone} />
          {workflow.requiresApproval && (
            <StatusBadge label="Needs approval" tone="danger" />
          )}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {workflow.bodyParagraphs.map((p, i) => (
          <p
            key={i}
            className="text-sm leading-6"
            style={{ color: "var(--text-secondary)" }}
          >
            {p}
          </p>
        ))}
      </div>
      {workflow.approvalReason && (
        <p
          className="mt-3 text-sm leading-6"
          style={{ color: "var(--warning)" }}
        >
          ⚠️ {workflow.approvalReason}
        </p>
      )}
    </div>
  );
}
