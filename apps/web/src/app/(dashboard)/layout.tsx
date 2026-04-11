import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <main
        className="flex-1 overflow-y-auto px-6 py-8 lg:px-10"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
