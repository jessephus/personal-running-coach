import Link from "next/link";

import { getResolvedModelProviderIntegrationConfig } from "@coachinclaw/db";

import { PageHeader } from "@/components/page-header";

import { saveModelProviderConfigAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ModelProviderConfigPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const state = await getResolvedModelProviderIntegrationConfig();
  const config = state.config;

  return (
    <>
      <PageHeader
        title="LLM Model Provider Configuration"
        subtitle="Store the API key and optional endpoint/model settings used for coaching workflows and memory extraction."
      />

      <Banner searchParams={params} />

      <Section title="Saved Configuration">
        <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Current source: {state.source === "database" ? "Dashboard database" : state.source === "environment" ? "Environment fallback" : "Not configured"}
        </p>
        <form action={saveModelProviderConfigAction} className="space-y-4">
          <Field
            label="API Key"
            name="apiKey"
            type="password"
            defaultValue={config?.apiKey ?? ""}
            required
            help="The provider secret used to call the chat completions API."
          />
          <Field
            label="Base URL"
            name="baseUrl"
            defaultValue={config?.baseUrl ?? ""}
            help="Optional OpenAI-compatible base URL. Leave blank for the default OpenAI API URL."
          />
          <Field
            label="Model Name"
            name="model"
            defaultValue={config?.model ?? ""}
            help="Optional model identifier. Leave blank to use the app default."
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Save Model Provider Configuration
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
            How to configure the model provider
          </summary>
          <div className="mt-4 space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
            <p>1. Choose an OpenAI-compatible provider such as OpenAI, OpenRouter, Azure-hosted OpenAI-compatible endpoints, or another vendor that supports chat completions.</p>
            <p>2. Create an API key in that provider dashboard and paste it into the form above.</p>
            <p>3. If the provider uses the standard OpenAI API URL, you can leave Base URL blank.</p>
            <p>4. If you are using a custom OpenAI-compatible endpoint, enter its base URL exactly, for example:</p>
            <CodeLine value="https://api.openai.com/v1" />
            <p>5. Enter a model name only if you want to override the app default. Choose a model that supports structured JSON output for the coaching workflows.</p>
            <p>6. After saving, the dashboard and worker will use this stored provider configuration on the next request cycle.</p>
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
    return <Notice tone="success" message="Model provider configuration saved." />;
  }

  if (searchParams.error === "missing-required") {
    return <Notice tone="danger" message="API Key is required." />;
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
