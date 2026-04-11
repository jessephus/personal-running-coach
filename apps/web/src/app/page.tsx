import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();

  return (
    <main className="app-shell flex flex-1 justify-center px-6 py-12 text-sm md:px-10">
      <div className="flex w-full max-w-7xl flex-col gap-8">
        <section className="glass-card rounded-[32px] px-8 py-10 md:px-10">
          <p className="eyebrow text-xs font-semibold">Personal running coach</p>
          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                A security-first coaching cockpit for training context, memory, and proactive
                nudges.
              </h1>
              <p className="muted max-w-2xl text-base leading-7">
                This MVP is intentionally scoped around Strava imports, curated coach memory, and
                Telegram outreach. The first-party dashboard remains the system of record for the
                athlete profile, sensitive context, and every future expansion point.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[26rem]">
              <MetricCard label="Weekly distance" value={`${data.dashboard.weeklyDistanceKm} km`} />
              <MetricCard
                label="Weekly time"
                value={`${data.dashboard.weeklyDurationMinutes} min`}
              />
              <MetricCard label="MVP mode" value="Strava-first" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
          <div className="glass-card rounded-[28px] p-7">
            <SectionHeading
              eyebrow="Coach focus"
              title={`What ${data.coachPersona.name} should remember about ${data.dashboard.athleteName}`}
              description={data.dashboard.currentFocus}
            />
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              {data.coachPersona.overview} {data.coachPersona.philosophy}
            </p>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <ListCard title="Coach priorities" items={data.dashboard.coachPriorities} />
              <ListCard title="Risk flags" items={data.dashboard.riskFlags} tone="amber" />
            </div>
            <div className="mt-6">
              <ListCard title="Memory highlights" items={data.dashboard.memoryHighlights} />
            </div>
          </div>

          <div className="glass-card rounded-[28px] p-7">
            <SectionHeading
              eyebrow="Environment"
              title="Readiness snapshot"
              description="Track which secrets are configured before wiring real integrations."
            />
            <div className="mt-5 space-y-3">
              {data.environmentStatus.map((item) => (
                <StatusRow
                  key={item.key}
                  label={item.key}
                  detail={item.description}
                  status={item.configured ? "Configured" : "Missing"}
                  tone={item.configured ? "green" : "slate"}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="glass-card rounded-[28px] p-7">
          <SectionHeading
            eyebrow="Coaching workflows"
            title="Live coaching output previews"
            description="The LLM is the primary coaching engine; code-owned guardrails still gate triggers, approvals, and channel safety."
          />
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {data.coachingWorkflows.map((wf) => (
              <div
                key={wf.workflow}
                className="rounded-2xl border border-white/10 bg-white/4 p-5"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {wf.workflow}
                    </p>
                    <p className="text-lg font-semibold text-white">{wf.headline}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${
                        wf.risk === "high"
                          ? "border-red-300/30 bg-red-300/15 text-red-100"
                          : wf.risk === "medium"
                            ? "border-amber-300/30 bg-amber-300/15 text-amber-100"
                            : "border-emerald-300/30 bg-emerald-300/15 text-emerald-100"
                      }`}
                    >
                      {wf.risk} risk
                    </span>
                    {wf.requiresApproval && (
                      <span className="rounded-full border border-red-300/30 bg-red-300/15 px-3 py-1 text-xs uppercase tracking-[0.14em] text-red-100">
                        Needs approval
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {wf.bodyParagraphs.map((p, i) => (
                    <p key={i} className="text-sm leading-6 text-slate-200">
                      {p}
                    </p>
                  ))}
                </div>
                {wf.approvalReason && (
                  <p className="mt-3 text-sm leading-6 text-amber-200/80">
                    ⚠️ {wf.approvalReason}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <ActionLink href="/api/coaching/debrief" label="Post-workout debrief JSON" />
            <ActionLink href="/api/coaching/weekly-review" label="Weekly review JSON" />
            <ActionLink href="/api/coaching/next-workout" label="Next workout JSON" />
            <ActionLink href="/api/coaching/fatigue-check" label="Fatigue check JSON" />
          </div>
        </section>

        <section className="glass-card rounded-[28px] p-7">
          <SectionHeading
            eyebrow="Deterministic guardrails"
            title="Code-owned rules that shape the model"
            description="These rules no longer generate the coaching copy themselves, but they still decide when to escalate, require approval, or constrain delivery."
          />
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {data.deterministicGuardrails.map((rule) => (
              <div
                key={rule.id}
                className="rounded-2xl border border-white/10 bg-white/4 p-5"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <p className="text-lg font-semibold text-white">{rule.title}</p>
                  <span className="rounded-full border border-white/10 bg-slate-200/6 px-3 py-1 text-xs uppercase tracking-[0.14em] text-slate-200">
                    {rule.scope}
                  </span>
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6">
                  <p className="text-slate-200">
                    <span className="font-medium text-white">When:</span> {rule.condition}
                  </p>
                  <p className="text-slate-300">
                    <span className="font-medium text-white">Effect:</span> {rule.effect}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
          <div className="glass-card rounded-[28px] p-7">
            <SectionHeading
              eyebrow="Integration roadmap"
              title="What ships in the MVP vs. what waits"
              description="The MVP is intentionally narrow so the training memory and safety model can get strong first."
            />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {data.integrations.map((integration) => (
                <IntegrationCard
                  key={integration.key}
                  label={integration.label}
                  detail={integration.detail}
                  status={integration.status}
                />
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <ActionLink href="/api/health" label="Open health endpoint" />
              <ActionLink href="/api/integrations" label="Inspect integration JSON" />
              <ActionLink href="/api/strava/connect" label="Preview Strava connect flow" />
            </div>
          </div>

          <div className="glass-card rounded-[28px] p-7">
            <SectionHeading
              eyebrow="Security posture"
              title="Non-negotiable controls"
              description="Sensitive training and health-adjacent data should be protected before model quality optimizations."
            />
            <div className="mt-5 space-y-3">
              {data.sensitiveFieldControls.map((control) => (
                <StatusRow
                  key={control.fieldPath}
                  label={control.fieldPath}
                  detail={control.protection}
                  status="Protected"
                  tone="green"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="glass-card rounded-[28px] p-7">
          <SectionHeading
            eyebrow="Threat model"
            title="Active threat actors and top risks"
            description={`${data.threatModel.activeRiskCount} active risks with ${data.threatModel.activeMitigationCount} mitigations · v${data.threatModel.version}`}
          />
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-4 text-lg font-semibold text-white">Threat actors</h3>
              <div className="space-y-3">
                {data.threatModel.threatActors.map((actor) => (
                  <StatusRow
                    key={actor.id}
                    label={actor.name}
                    detail={actor.description}
                    status={actor.mvpRelevance === "active" ? "Active" : "Deferred"}
                    tone={actor.mvpRelevance === "active" ? "amber" : "slate"}
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-4 text-lg font-semibold text-white">Top risks</h3>
              <div className="space-y-3">
                {data.threatModel.topRisks
                  .filter((risk) => risk.mvpRelevance === "active")
                  .map((risk) => (
                    <div
                      key={risk.id}
                      className="rounded-2xl border border-white/10 bg-white/4 p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <p className="font-medium text-white">{risk.title}</p>
                        <span
                          className={`shrink-0 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${
                            risk.severity === "critical"
                              ? "border-red-300/30 bg-red-300/15 text-red-100"
                              : risk.severity === "high"
                                ? "border-amber-300/30 bg-amber-300/15 text-amber-100"
                                : "border-white/10 bg-slate-200/6 text-slate-200"
                          }`}
                        >
                          {risk.severity}
                        </span>
                      </div>
                      <p className="muted mt-2 leading-6">{risk.description}</p>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-200">
                        {risk.mitigations.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="glass-card rounded-[28px] p-7">
            <SectionHeading
              eyebrow="Data governance"
              title="Data classification and lifecycle"
              description="Every data class has a defined sensitivity level, retention policy, and deletion rule."
            />
            <div className="mt-5 space-y-3">
              {data.threatModel.dataClassifications.map((dc) => (
                <div
                  key={dc.id}
                  className="rounded-2xl border border-white/10 bg-white/4 p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <p className="font-medium text-white">{dc.label}</p>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${
                        dc.sensitivity === "critical"
                          ? "border-red-300/30 bg-red-300/15 text-red-100"
                          : dc.sensitivity === "high"
                            ? "border-amber-300/30 bg-amber-300/15 text-amber-100"
                            : "border-emerald-300/30 bg-emerald-300/15 text-emerald-100"
                      }`}
                    >
                      {dc.sensitivity}
                    </span>
                  </div>
                  <p className="muted mt-2 leading-6">{dc.description}</p>
                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Retention</p>
                      <p className="mt-1 text-slate-200">{dc.retentionPolicy}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Deletion</p>
                      <p className="mt-1 text-slate-200">{dc.deletionRule}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-[28px] p-7">
            <SectionHeading
              eyebrow="Provider guardrails"
              title="Rules for every external provider"
              description="Each provider has scoped rules that constrain what data flows through it."
            />
            <div className="mt-5 space-y-3">
              {data.threatModel.providerGuardrails.map((pg) => (
                <div
                  key={pg.provider}
                  className="rounded-2xl border border-white/10 bg-white/4 p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <p className="font-medium text-white">{pg.provider}</p>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${
                        pg.mvpRelevance === "active"
                          ? "border-teal-300/30 bg-teal-300/15 text-teal-100"
                          : "border-white/10 bg-slate-200/6 text-slate-200"
                      }`}
                    >
                      {pg.mvpRelevance}
                    </span>
                  </div>
                  <p className="muted mt-2 text-sm">{pg.scope}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-200">
                    {pg.rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <h3 className="mb-3 text-lg font-semibold text-white">Messaging constraints</h3>
              <div className="space-y-3">
                {data.threatModel.messagingConstraints.map((mc) => (
                  <div
                    key={mc.channel}
                    className="rounded-2xl border border-white/10 bg-white/4 p-4"
                  >
                    <p className="font-medium text-white">{mc.channel}</p>
                    <p className="muted mt-2 text-sm">{mc.maxContentScope}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Prohibited content
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-red-200/80">
                      {mc.prohibitedContent.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <ActionLink href="/api/threat-model" label="Inspect threat model JSON" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="glass-card rounded-[28px] p-7">
            <SectionHeading
              eyebrow="Deferred issue specs"
              title="Future implementation issues already have shape"
              description="Every deferred MVP item has a structured spec ready to become a GitHub Issue with security notes and acceptance criteria."
            />
            <div className="mt-6 grid gap-4">
              {data.deferredFeatures.map((feature) => (
                <article
                  key={feature.slug}
                  className="rounded-2xl border border-white/10 bg-white/4 p-5"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                      Deferred from MVP
                    </span>
                  </div>
                  <p className="muted mt-3 leading-6">{feature.whyDeferred}</p>
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-200">
                    {feature.acceptanceCriteria.slice(0, 2).map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-[28px] p-7">
            <SectionHeading
              eyebrow="Data model"
              title="Canonical source-of-truth tables"
              description="Structured data stays primary. Summaries and memories stay secondary."
            />
            <div className="mt-5 space-y-3">
              {data.tableCatalog.map((table) => (
                <StatusRow
                  key={table.tableName}
                  label={table.tableName}
                  detail={table.purpose}
                  status={table.mvpRequired ? "MVP" : "Later"}
                  tone={table.mvpRequired ? "green" : "slate"}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <p className="eyebrow text-xs font-semibold">{eyebrow}</p>
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      <p className="muted max-w-2xl leading-6">{description}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ListCard({
  title,
  items,
  tone = "teal",
}: {
  title: string;
  items: string[];
  tone?: "teal" | "amber";
}) {
  const dotClass = tone === "amber" ? "bg-amber-300" : "bg-teal-300";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-slate-200">
            <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
            <span className="leading-6">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IntegrationCard({
  label,
  detail,
  status,
}: {
  label: string;
  detail: string;
  status: string;
}) {
  const tone =
    status === "mvp"
      ? "border-teal-300/40 bg-teal-300/10 text-teal-100"
      : "border-white/10 bg-white/5 text-slate-200";

  return (
    <div className={`rounded-2xl border p-5 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{label}</h3>
        <span className="rounded-full border border-current/20 px-3 py-1 text-xs uppercase tracking-[0.14em]">
          {status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6">{detail}</p>
    </div>
  );
}

function StatusRow({
  label,
  detail,
  status,
  tone,
}: {
  label: string;
  detail: string;
  status: string;
  tone: "green" | "slate" | "amber";
}) {
  const toneClasses = {
    green: "bg-emerald-300/15 text-emerald-100 border-emerald-300/30",
    slate: "bg-slate-200/6 text-slate-200 border-white/10",
    amber: "bg-amber-300/15 text-amber-100 border-amber-300/30",
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/4 p-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1">
        <p className="font-medium text-white">{label}</p>
        <p className="muted leading-6">{detail}</p>
      </div>
      <span
        className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${toneClasses[tone]}`}
      >
        {status}
      </span>
    </div>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/10"
    >
      {label}
    </a>
  );
}
