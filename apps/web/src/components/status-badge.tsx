export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral" | "accent";
}) {
  const toneStyles: Record<typeof tone, string> = {
    success: "background: var(--success); color: #fff",
    warning: "background: var(--warning); color: #fff",
    danger: "background: var(--danger); color: #fff",
    neutral: "background: var(--bg-secondary); color: var(--text-secondary)",
    accent: "background: var(--accent); color: #fff",
  };

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={Object.fromEntries(
        toneStyles[tone].split(";").map((s) => {
          const [k, v] = s.split(":").map((x) => x.trim());
          return [k, v];
        }),
      )}
    >
      {label}
    </span>
  );
}
