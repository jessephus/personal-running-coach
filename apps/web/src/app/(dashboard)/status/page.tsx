import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getStatusData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const data = await getStatusData();

  const allConfigured = data.envStatus.every((e) => e.configured);

  return (
    <>
      <PageHeader
        title="Status"
        subtitle="System health, integration status, and active connections."
      />

      {/* Overall health */}
      <Section title="System Health">
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: allConfigured ? "var(--success)" : "var(--warning)" }}
          />
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {allConfigured ? "All environment variables configured" : "Some environment variables missing"}
          </p>
        </div>
      </Section>

      {/* Integration status cards */}
      <Section title="Integration Status">
        <div className="grid gap-4 sm:grid-cols-2">
          {data.integrations.map((integration) => (
            <div
              key={integration.key}
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {integration.label}
                </p>
                <StatusBadge
                  label={integration.status}
                  tone={integration.status === "mvp" ? "accent" : "neutral"}
                />
              </div>
              <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                {integration.detail}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Active connections */}
      {data.connections ? (
        data.connections.length > 0 ? (
          <Section title="Source Connections">
            <div className="space-y-2">
              {data.connections.map((conn) => (
                <div
                  key={conn.provider}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                  style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
                >
                  <div>
                    <p className="text-sm font-medium capitalize" style={{ color: "var(--text-primary)" }}>
                      {conn.provider}
                    </p>
                    {conn.lastSyncedAt && (
                      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        Last synced: {new Date(conn.lastSyncedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    label={conn.status}
                    tone={
                      conn.status === "connected"
                        ? "success"
                        : conn.status === "error"
                          ? "danger"
                          : "neutral"
                    }
                  />
                </div>
              ))}
            </div>
          </Section>
        ) : (
          <Section title="Source Connections">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              No connections configured yet.
            </p>
          </Section>
        )
      ) : null}
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
