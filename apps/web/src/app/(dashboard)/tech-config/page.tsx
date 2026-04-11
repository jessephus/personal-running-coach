import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getTechConfigData } from "@/lib/page-data";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";

export default function TechConfigPage() {
  const data = getTechConfigData();

  return (
    <>
      <PageHeader
        title="Technical Configuration"
        subtitle="Environment variables and integration status."
      />

      {/* Env var checklist */}
      <Section title="Environment Variables">
        <div className="space-y-2">
          {data.environmentStatus.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
              style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
            >
              <div className="flex items-center gap-3">
                <FontAwesomeIcon
                  icon={item.configured ? faCheck : faXmark}
                  className="h-4 w-4"
                  style={{ color: item.configured ? "var(--success)" : "var(--danger)" }}
                />
                <div>
                  <p className="text-sm font-medium font-mono" style={{ color: "var(--text-primary)" }}>
                    {item.key}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {item.description}
                  </p>
                </div>
              </div>
              <StatusBadge
                label={item.configured ? "Configured" : "Missing"}
                tone={item.configured ? "success" : "danger"}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Integration cards */}
      <Section title="Integrations">
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
