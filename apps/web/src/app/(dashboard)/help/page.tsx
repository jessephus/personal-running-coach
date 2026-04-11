import { PageHeader } from "@/components/page-header";
import { getGuardrailsData } from "@/lib/page-data";

export default function HelpPage() {
  const guardrails = getGuardrailsData();

  return (
    <>
      <PageHeader
        title="Help"
        subtitle="How Coachin'Claw works, architecture overview, and guardrail reference."
      />

      {/* Architecture */}
      <Section title="Architecture">
        <p>
          Coachin&apos;Claw is an <strong>LLM-driven coaching app</strong> with deterministic guardrails in code.
          The LLM generates coaching recommendations, extracts athlete memories, and drives proactive check-ins.
          Code-owned rules gate approval of high-risk suggestions, enforce Telegram safety constraints, and
          redact PII before prompts reach the model.
        </p>
        <h3 className="mt-5 mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Core Flows
        </h3>
        <ul className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <li><strong style={{ color: "var(--text-primary)" }}>Strava ingestion</strong> — Connect Strava → fetch workouts → store encrypted in DB</li>
          <li><strong style={{ color: "var(--text-primary)" }}>Coaching decision</strong> — LLM analyzes athlete data → generates recommendation → guardrails check safety</li>
          <li><strong style={{ color: "var(--text-primary)" }}>Memory extraction</strong> — Inbound Telegram messages → LLM extracts durable athlete memories → persists to DB</li>
          <li><strong style={{ color: "var(--text-primary)" }}>Proactive check-ins</strong> — Worker sends periodic LLM-generated nudges through Telegram</li>
        </ul>
      </Section>

      {/* Stack */}
      <Section title="Technology Stack">
        <div className="grid gap-4 sm:grid-cols-2">
          <StackItem label="Web App" value="Next.js 16 (dashboard + API routes)" />
          <StackItem label="Worker" value="Background Telegram check-in daemon" />
          <StackItem label="Database" value="PostgreSQL with Drizzle ORM" />
          <StackItem label="Encryption" value="AES-256-GCM at application layer" />
          <StackItem label="Model Provider" value="OpenAI-compatible (OpenRouter, Azure, etc.)" />
          <StackItem label="Messaging" value="Telegram (inbound + outbound)" />
        </div>
      </Section>

      {/* Deterministic vs LLM */}
      <Section title="Deterministic vs LLM">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--accent)" }}>
              Code-Owned (Deterministic)
            </h3>
            <ul className="space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              <li>Risk classification</li>
              <li>Approval gates</li>
              <li>Telegram character limit (500)</li>
              <li>Prompt privacy review / PII redaction</li>
              <li>Webhook verification</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--accent-secondary)" }}>
              LLM-Driven
            </h3>
            <ul className="space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              <li>Workflow selection (next workout vs recovery)</li>
              <li>Suggestion text generation</li>
              <li>Memory extraction from messages</li>
              <li>Reasoning explanations</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Guardrails reference */}
      <Section title="Guardrail Reference">
        <div className="space-y-3">
          {guardrails.map((g) => (
            <div
              key={g.id}
              className="rounded-lg border px-4 py-3"
              style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {g.title}
                </p>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}
                >
                  {g.scope}
                </span>
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>When:</span> {g.condition}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>Effect:</span> {g.effect}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Quick start */}
      <Section title="Quick Start">
        <div className="space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>Self-hosted:</strong>{" "}
            <code className="rounded px-1.5 py-0.5 text-xs font-mono" style={{ background: "var(--bg-secondary)" }}>
              npm run selfhost:up
            </code>
          </p>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>Dev server:</strong>{" "}
            <code className="rounded px-1.5 py-0.5 text-xs font-mono" style={{ background: "var(--bg-secondary)" }}>
              npm run dev:web
            </code>
          </p>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>Health check:</strong>{" "}
            <code className="rounded px-1.5 py-0.5 text-xs font-mono" style={{ background: "var(--bg-secondary)" }}>
              curl http://localhost:3000/api/health
            </code>
          </p>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>API endpoints:</strong>{" "}
            <a href="/api/health" className="underline" style={{ color: "var(--accent)" }}>/api/health</a>
            {" · "}
            <a href="/api/integrations" className="underline" style={{ color: "var(--accent)" }}>/api/integrations</a>
            {" · "}
            <a href="/api/threat-model" className="underline" style={{ color: "var(--accent)" }}>/api/threat-model</a>
          </p>
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
      <div className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

function StackItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}
