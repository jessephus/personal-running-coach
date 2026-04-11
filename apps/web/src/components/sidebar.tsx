"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faChartLine,
  faCircleCheck,
  faCircleQuestion,
  faClipboardList,
  faComments,
  faGear,
  faHouse,
  faShieldHalved,
  faSliders,
  faChevronLeft,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import { SidebarLink } from "./sidebar-link";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/", icon: faHouse, label: "Home" },
  { href: "/coaching", icon: faClipboardList, label: "Coaching" },
  { href: "/chat", icon: faComments, label: "Chat Logs" },
  { href: "/training", icon: faChartLine, label: "Training Data" },
  { href: "/coach-config", icon: faSliders, label: "Coach Config" },
  { href: "/tech-config", icon: faGear, label: "Tech Config" },
  { href: "/governance", icon: faShieldHalved, label: "Governance" },
  { href: "/status", icon: faCircleCheck, label: "Status" },
  { href: "/help", icon: faCircleQuestion, label: "Help" },
] as const;

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  }, []);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg p-2 lg:hidden"
        style={{ color: "var(--text-primary)", background: "var(--bg-secondary)" }}
      >
        <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-200
          lg:relative lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${collapsed ? "w-16" : "w-56"}`}
        style={{
          background: "var(--sidebar-bg)",
          borderColor: "var(--border)",
        }}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between px-3 py-4">
          <div className={`flex items-center gap-2 ${collapsed ? "justify-center w-full" : ""}`}>
            <Image
              src="/logo.png"
              alt="Coachin'Claw"
              width={collapsed ? 32 : 40}
              height={collapsed ? 32 : 40}
              className="shrink-0"
            />
            {!collapsed && (
              <span
                className="text-base font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                Coachin&apos;Claw
              </span>
            )}
          </div>

          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden"
            style={{ color: "var(--text-secondary)" }}
          >
            <FontAwesomeIcon icon={faXmark} className="h-5 w-5" />
          </button>

          {/* Desktop collapse */}
          <button
            onClick={toggleCollapsed}
            className="hidden lg:block"
            style={{ color: "var(--text-secondary)" }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <FontAwesomeIcon
              icon={faChevronLeft}
              className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Theme toggle at bottom */}
        <div className="px-2 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <ThemeToggle collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}
