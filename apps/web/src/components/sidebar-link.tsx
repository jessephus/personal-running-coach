"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export function SidebarLink({
  href,
  icon,
  label,
  collapsed,
}: {
  href: string;
  icon: IconDefinition;
  label: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-[var(--sidebar-active)] text-[var(--accent)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--sidebar-active)] hover:text-[var(--text-primary)]"
      }`}
    >
      <FontAwesomeIcon icon={icon} className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
