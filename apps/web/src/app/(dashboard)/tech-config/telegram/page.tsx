import Link from "next/link";

import { getResolvedTelegramIntegrationConfig } from "@coachinclaw/db";

import { PageHeader } from "@/components/page-header";
import { getServerConfig } from "@/lib/server-config";

import { saveTelegramConfigAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function TelegramConfigPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const state = await getResolvedTelegramIntegrationConfig();
  const config = state.config;
  const appUrl = getServerConfig().appUrl;

  return (
    <>
      <PageHeader
        title="Telegram Configuration"
        subtitle="Store Telegram bot settings in the database so inbound webhooks and outbound check-ins run without local secrets files."
      />

      <Banner searchParams={params} />

      <Section title="Saved Configuration">
        <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          Current source: {state.source === "database" ? "Dashboard database" : state.source === "environment" ? "Environment fallback" : "Not configured"}
        </p>
        <form action={saveTelegramConfigAction} className="space-y-4">
          <Field
            label="Bot Token"
            name="botToken"
            type="password"
            defaultValue={config?.botToken ?? ""}
            required
            help="Issued by BotFather and used to call the Telegram Bot API."
          />
          <Field
            label="Chat ID"
            name="chatId"
            defaultValue={config?.chatId ?? ""}
            required
            help="The specific Telegram chat allowed for inbound messages and outbound nudges."
          />
          <Field
            label="Webhook Secret"
            name="webhookSecret"
            type="password"
            defaultValue={config?.webhookSecret ?? ""}
            required
            help="Used to verify the X-Telegram-Bot-Api-Secret-Token header on inbound webhook calls."
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Save Telegram Configuration
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
            How to create the bot, get the chat ID, and register the webhook
          </summary>
          <div className="mt-4 space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
            <p>1. In Telegram, open BotFather and create a bot with /newbot.</p>
            <p>2. Copy the bot token into the form above.</p>
            <p>3. Start a chat with your bot and send any message.</p>
            <p>4. Before registering a webhook, use Telegram getUpdates to find the numeric chat ID for that conversation.</p>
            <p>5. Save a webhook secret above and then register your webhook URL. The webhook endpoint for this app is:</p>
            <CodeLine value={`${appUrl}/api/telegram/webhook`} />
            <p>6. This repo also includes a helper endpoint that can register the webhook for you once the bot token and secret are saved:</p>
            <CodeLine value={`${appUrl}/api/telegram/setup-webhook`} />
            <p>7. Only messages from the configured Chat ID will be accepted.</p>
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
    return <Notice tone="success" message="Telegram configuration saved." />;
  }

  if (searchParams.error === "missing-required") {
    return <Notice tone="danger" message="Bot Token, Chat ID, and Webhook Secret are required." />;
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
