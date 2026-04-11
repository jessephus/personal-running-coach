import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { getGovernanceData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function GovernancePage() {
  const data = await getGovernanceData();

  return (
    <>
      <PageHeader
        title="Governance"
        subtitle="Data retention, audit coverage, and lifecycle operations."
      />

      {/* Retention policies */}
      <Section title="Retention Policies">
        <div className="space-y-3">
          {data.summary.retentionPolicies.map((policy) => (
            <div
              key={policy.dataClassId}
              className="flex items-start justify-between rounded-lg border px-4 py-3"
              style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {policy.label}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {policy.description}
                </p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                  {policy.retentionDays === 0
                    ? "Immediate"
                    : `${policy.retentionDays} days`}
                </p>
                <p className="mt-1 text-xs capitalize" style={{ color: "var(--text-secondary)" }}>
                  {policy.pruneStrategy}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Audit coverage */}
      <Section title="Audit Coverage">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Audited Actions"
            value={`${data.summary.auditCoverage.implementedActions} / ${data.summary.auditCoverage.totalActions}`}
          />
          <StatCard
            label="Coverage"
            value={`${Math.round(data.summary.auditCoverage.coveragePercent)}%`}
          />
          <StatCard
            label="Deletion Scopes"
            value={`${data.summary.deletionScopes.length}`}
          />
        </div>
      </Section>

      {/* Recent audit events */}
      {data.recentAuditEvents ? (
        data.recentAuditEvents.length > 0 ? (
          <Section title="Recent Audit Events">
            <div className="space-y-2">
              {data.recentAuditEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-2 text-xs"
                  style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
                      {new Date(event.occurredAt).toLocaleString()}
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>{event.action}</span>
                    <span style={{ color: "var(--text-secondary)" }}>on {event.resourceType}</span>
                  </div>
                  <StatusBadge
                    label={event.outcome}
                    tone={event.outcome === "success" ? "success" : event.outcome === "blocked" ? "warning" : "danger"}
                  />
                </div>
              ))}
            </div>
          </Section>
        ) : (
          <Section title="Recent Audit Events">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              No audit events recorded yet.
            </p>
          </Section>
        )
      ) : (
        <EmptyState
          message="Audit events unavailable"
          detail="Configure DATABASE_URL to view audit events."
        />
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="mb-6 rounded-xl border p-5"
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border px-4 py-3 text-center"
      style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}
