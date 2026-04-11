import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { WorkflowCard } from "@/components/workflow-card";
import { getCoachingData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function CoachingPage() {
  const data = await getCoachingData();

  return (
    <>
      <PageHeader
        title="Coaching"
        subtitle="Live LLM-generated coaching workflows with code-owned guardrails."
      />

      {!data || data.workflows.length === 0 ? (
        <EmptyState
          message="No coaching workflows available"
          detail="Coaching workflows require a connected athlete profile, synced workouts, and a configured model provider."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {data.workflows.map((wf) => (
            <WorkflowCard key={wf.workflow} workflow={wf} />
          ))}
        </div>
      )}
    </>
  );
}
