import Link from "next/link";

import { getResolvedStravaIntegrationConfig } from "@coachinclaw/db";

import { PageHeader } from "@/components/page-header";
import { getServerConfig } from "@/lib/server-config";

import { saveStravaConfigAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function StravaConfigPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const state = await getResolvedStravaIntegrationConfig();
  const config = state.config;
  const appUrl = getServerConfig().appUrl;

  return (
    <>
      <PageHeader
        title="Strava Configuration"
        subtitle="Store your Strava app credentials in the database so OAuth and activity sync can run without local .env management."
      />

      <Banner searchParams={params} />

      <Section title="Saved Configuration">
        <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Current source: {state.source === "database" ? "Dashboard database" : state.source === "environment" ? "Environment fallback" : "Not configured"}
        </p>
        <form action={saveStravaConfigAction} className="space-y-4">
          <Field
            label="Client ID"
            name="clientId"
            defaultValue={config?.clientId ?? ""}
            required
            help="From your Strava developer application settings."
          />
          <Field
            label="Client Secret"
            name="clientSecret"
            type="password"
            defaultValue={config?.clientSecret ?? ""}
            required
            help="Used server-side to exchange OAuth codes and refresh tokens."
          />
          <Field
            label="Webhook Verify Token"
            name="webhookVerifyToken"
            defaultValue={config?.webhookVerifyToken ?? ""}
            help="Optional but recommended for Strava webhook challenge validation."
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Save Strava Configuration
            </button>
            <Link href="/tech-config" className="text-sm underline" style={{ color: "var(--accent-secondary)" }}>
              Back to Tech Config
            </Link>
          </div>
        </form>
      </Section>

      <Section title="Setup Help">
        <details>
          <summary className="cursor-pointer text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            How to create and connect a Strava app
          </summary>
          <div className="mt-4 space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
            <p>1. Go to Strava developer settings at https://www.strava.com/settings/api and create a developer application.</p>
            <p>2. Copy the Client ID and Client Secret into the form above.</p>
            <p>3. Set the authorization callback domain to match your app URL. The callback route for this app is:</p>
            <CodeLine value={`${appUrl}/api/strava/callback`} />
            <p>4. If you want webhook-driven sync, create a webhook subscription pointing at:</p>
            <CodeLine value={`${appUrl}/api/strava/webhook`} />
            <p>5. Choose a webhook verify token, save it here, and use the same value when registering the Strava webhook subscription.</p>
            <p>6. After saving, use the Strava connect flow from the app to authorize the athlete account.</p>
          </div>
        </details>
      </Section>
    </>
  );
}

function Banner({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (searchParams.saved === "1") {
    return <Notice tone="success" message="Strava configuration saved." />;
  }

  if (searchParams.error === "missing-required") {
    return <Notice tone="danger" message="Client ID and Client Secret are required." />;
  }

  return null;
}

function Notice({ tone, message }: { tone: "success" | "danger" ; message: string }) {
  return (
    <div
      className="mb-6 rounded-lg border px-4 py-3 text-sm"
      style={{
        borderColor: tone === "success" ? "var(--success)" : "var(--danger)",
        background: tone === "success" ? "color-mix(in srgb, var(--success) 12%, var(--bg-card))" : "color-mix(in srgb, var(--danger) 12%, var(--bg-card))",
        color: "var(--text-primary)",
      }}
    >
      {message}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, name, defaultValue, help, required, type = "text" }: { label: string; name: string; defaultValue: string; help: string; required?: boolean; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
      />
      <span className="mt-1 block text-xs" style={{ color: "var(--text-secondary)" }}>{help}</span>
    </label>
  );
}

function CodeLine({ value }: { value: string }) {
  return (
    <code className="block rounded-lg px-3 py-2 text-xs" style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}>
      {value}
    </code>
  );
}
