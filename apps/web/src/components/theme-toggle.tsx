"use client";

import { useCallback, useSyncExternalStore } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";

function getThemeSnapshot(): "day" | "night" {
  if (typeof window === "undefined") return "day";
  return document.documentElement.getAttribute("data-theme") === "night"
    ? "night"
    : "day";
}

function getServerSnapshot(): "day" | "night" {
  return "day";
}

function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = theme === "day" ? "night" : "day";
    if (next === "night") {
      document.documentElement.setAttribute("data-theme", "night");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("theme", next);
  }, [theme]);

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--sidebar-active)]"
      style={{ color: "var(--text-secondary)" }}
      title={theme === "day" ? "Switch to night theme" : "Switch to day theme"}
    >
      <FontAwesomeIcon
        icon={theme === "day" ? faMoon : faSun}
        className="h-4 w-4 shrink-0"
      />
      {!collapsed && (
        <span>{theme === "day" ? "Night mode" : "Day mode"}</span>
      )}
    </button>
  );
}
