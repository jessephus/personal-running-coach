import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { getHomeData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getHomeData();

  if (!data) {
    return (
      <>
        <PageHeader
          title="Home"
          subtitle="Overview of your training and coaching activity."
        />
        <EmptyState
          message="No athlete profile found"
          detail="Connect Strava to create your athlete profile and start syncing workouts."
        />
      </>
    );
  }

  const { dashboard, connections } = data;

  return (
    <>
      <PageHeader
        title={`Welcome, ${dashboard.athleteName}`}
        subtitle={dashboard.currentFocus}
      />

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Weekly distance" value={`${dashboard.weeklyDistanceKm} km`} />
        <SummaryCard label="Weekly time" value={`${dashboard.weeklyDurationMinutes} min`} />
        <SummaryCard
          label="Connections"
          value={connections.length > 0 ? `${connections.length} active` : "None"}
        />
      </div>

      {/* Priorities */}
      {dashboard.coachPriorities.length > 0 && (
        <Section title="Coach Priorities">
          <ul className="space-y-2">
            {dashboard.coachPriorities.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--accent-secondary)" }} />
                {p}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Risk flags */}
      {dashboard.riskFlags.length > 0 && (
        <Section title="Risk Flags">
          <div className="flex flex-wrap gap-2">
            {dashboard.riskFlags.map((f) => (
              <StatusBadge key={f} label={f} tone="warning" />
            ))}
          </div>
        </Section>
      )}

      {/* Memories */}
      {dashboard.memoryHighlights.length > 0 && (
        <Section title="Memory Highlights">
          <ul className="space-y-2">
            {dashboard.memoryHighlights.map((m) => (
              <li key={m} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {m}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Connection status */}
      {connections.length > 0 && (
        <Section title="Connections">
          <div className="flex flex-wrap gap-3">
            {connections.map((c) => (
              <div
                key={c.provider}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                }}
              >
                <span className="capitalize">{c.provider}</span>
                <StatusBadge
                  label={c.status}
                  tone={c.status === "connected" ? "success" : c.status === "error" ? "danger" : "neutral"}
                />
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border px-5 py-4"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-card)",
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="mb-6 rounded-xl border p-5"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-card)",
      }}
    >
      <h2 className="mb-3 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
