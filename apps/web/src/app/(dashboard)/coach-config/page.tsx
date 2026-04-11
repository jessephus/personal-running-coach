import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { getCoachConfigData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function CoachConfigPage() {
  const data = await getCoachConfigData();

  return (
    <>
      <PageHeader
        title="Coach Configuration"
        subtitle="Coach persona, athlete goals, and coaching constraints."
      />

      {/* Persona */}
      <Section title="Coach Persona">
        <div className="space-y-3">
          <Field label="Name" value={data.persona.name} />
          <Field label="Philosophy" value={data.persona.philosophy} />
          <Field label="Overview" value={data.persona.overview} />
          <div>
            <FieldLabel>Specialties</FieldLabel>
            <ul className="mt-1 space-y-1">
              {data.persona.specialties.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--accent-secondary)" }} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <FieldLabel>Voice Directives</FieldLabel>
            <ul className="mt-1 space-y-1">
              {data.persona.voiceDirectives.map((d) => (
                <li key={d} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Athlete profile */}
      {data.profile ? (
        <Section title="Athlete Profile">
          <div className="space-y-3">
            <Field label="Name" value={data.profile.displayName} />
            <Field label="Timezone" value={data.profile.timezone} />
            <Field label="Coaching Style" value={data.profile.coachingStyle} />
            <Field label="Long Run Day" value={data.profile.preferredLongRunDay} />
            {data.profile.constraints.length > 0 && (
              <div>
                <FieldLabel>Constraints</FieldLabel>
                <ul className="mt-1 space-y-1">
                  {data.profile.constraints.map((c) => (
                    <li key={c} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      • {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      ) : (
        <EmptyState
          message="No athlete profile"
          detail="Connect Strava to create your athlete profile."
        />
      )}

      {/* Goals */}
      {data.goals && data.goals.length > 0 ? (
        <Section title="Goals">
          <div className="space-y-3">
            {data.goals.map((g) => (
              <div
                key={g.name}
                className="flex items-start justify-between rounded-lg border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{g.name}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{g.notes}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                    Priority {g.priority}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {g.targetDate}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : data.profile ? (
        <Section title="Goals">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No goals configured yet.</p>
        </Section>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-0.5 text-sm" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
      {children}
    </p>
  );
}
