import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { getChatData } from "@/lib/page-data";
import { ChatTable } from "./chat-table";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const rows = await getChatData();

  return (
    <>
      <PageHeader
        title="Chat Logs"
        subtitle="Inbound and outbound messages across all channels."
      />

      {!rows || rows.length === 0 ? (
        <EmptyState
          message="No messages yet"
          detail="Messages will appear here once Telegram is connected and the worker starts sending check-ins."
        />
      ) : (
        <ChatTable rows={rows} />
      )}
    </>
  );
}
