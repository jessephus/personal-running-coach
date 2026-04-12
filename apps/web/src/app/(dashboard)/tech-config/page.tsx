import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getTechConfigData } from "@/lib/page-data";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";

export default async function TechConfigPage() {
  const data = await getTechConfigData();
  const statusByProvider = new Map(
    data.integrationStatuses.map((item) => [item.provider, item]),
  );

  const integrationCards = [
    ...data.integrations.map((integration) => {
      if (integration.key === "strava") {
        const status = statusByProvider.get("strava");
        return {
          ...integration,
          href: "/tech-config/strava",
          displayStatus: status?.configured ? "Ready" : "Missing",
          tone: status?.configured ? ("success" as const) : ("danger" as const),
          source: status?.source ?? "missing",
        };
      }

      if (integration.key === "telegram") {
        const status = statusByProvider.get("telegram");
        return {
          ...integration,
          href: "/tech-config/telegram",
          displayStatus: status?.configured ? "Ready" : "Missing",
          tone: status?.configured ? ("success" as const) : ("danger" as const),
          source: status?.source ?? "missing",
        };
      }

      return {
        ...integration,
        href: null,
        displayStatus: "Deferred",
        tone: "neutral" as const,
        source: "missing" as const,
      };
    }),
    {
      key: "model-provider",
      label: "LLM Model Provider",
      detail:
        "Structured-output capable provider used for coaching workflows and memory extraction.",
      href: "/tech-config/model-provider",
      displayStatus: statusByProvider.get("model-provider")?.configured ? "Configured" : "Missing",
      tone: statusByProvider.get("model-provider")?.configured
        ? ("success" as const)
        : ("danger" as const),
      source: statusByProvider.get("model-provider")?.source ?? "missing",
    },
  ];

  return (
    <>
      <PageHeader
        title="Technical Configuration"
        subtitle="Environment variables and integration status."
      />

      {/* Integration cards */}
      <Section title="Integrations">
        <div className="grid gap-4 sm:grid-cols-2">
          {integrationCards.map((integration) => (
            <CardShell
              key={integration.key}
              href={integration.href}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {integration.label}
                </p>
                <StatusBadge label={integration.displayStatus} tone={integration.tone} />
              </div>
              <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                {integration.detail}
              </p>
              {integration.href && (
                <p className="mt-3 text-xs" style={{ color: "var(--accent-secondary)" }}>
                  {integration.source === "database"
                    ? "Configured from dashboard"
                    : integration.source === "environment"
                      ? "Using environment fallback"
                      : "Open config page"}
                </p>
              )}
            </CardShell>
          ))}
        </div>
      </Section>

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

function CardShell({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  const className = "block rounded-xl border p-4 transition-colors";
  const style = { borderColor: "var(--border)", background: "var(--bg-secondary)" };

  if (!href) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}
