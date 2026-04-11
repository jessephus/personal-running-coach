import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInbox } from "@fortawesome/free-solid-svg-icons";

export function EmptyState({
  message,
  detail,
}: {
  message: string;
  detail?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border px-6 py-16 text-center"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-card)",
      }}
    >
      <FontAwesomeIcon
        icon={faInbox}
        className="mb-4 h-10 w-10"
        style={{ color: "var(--text-secondary)", opacity: 0.5 }}
      />
      <p
        className="text-base font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {message}
      </p>
      {detail && (
        <p
          className="mt-2 max-w-sm text-sm"
          style={{ color: "var(--text-secondary)", opacity: 0.7 }}
        >
          {detail}
        </p>
      )}
    </div>
  );
}
