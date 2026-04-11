import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { getTrainingData } from "@/lib/page-data";
import { TrainingTable } from "./training-table";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const rows = await getTrainingData();

  return (
    <>
      <PageHeader
        title="Training Data"
        subtitle="Synced workout history from Strava."
      />

      {!rows || rows.length === 0 ? (
        <EmptyState
          message="No workouts synced yet"
          detail="Connect Strava to start importing your training history."
        />
      ) : (
        <TrainingTable rows={rows} />
      )}
    </>
  );
}
