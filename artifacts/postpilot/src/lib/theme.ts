// Lightweight theme controller. We don't pull in next-themes because we're
// not using Next.js — just a class toggle on <html> plus localStorage.
//
// Three modes: "light", "dark", "system". The system mode follows the OS
// preference via prefers-color-scheme and re-evaluates if the OS flips at
// runtime (rare, but cheap to support).
import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "konnectpilot:theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStored(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = theme === "system" ? getSystemTheme() : theme;
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

// Apply the stored theme as early as possible. Call this once in main.tsx
// to avoid a "flash of wrong theme" on initial load.
export function initTheme() {
  applyTheme(readStored());
  // Re-apply on system change when the user has chosen "system".
  if (typeof window !== "undefined") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", () => {
      if (readStored() === "system") applyTheme("system");
    });
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => readStored());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(next: Theme) {
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
    setThemeState(next);
  }

  function toggle() {
    // Skip "system" in the toggle cycle — most users just want a quick flip.
    // The system option is still reachable from the dropdown.
    const resolved = theme === "system" ? getSystemTheme() : theme;
    setTheme(resolved === "dark" ? "light" : "dark");
  }

  return { theme, setTheme, toggle };
}
