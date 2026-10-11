"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { getTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";

/** Sun/moon button that switches between paper (light) and Night desk (dark). */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  // Server render assumes paper (light); the real theme is read after hydration.
  const theme = useSyncExternalStore<Theme>(subscribeTheme, getTheme, () => "light");
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-line bg-panel text-white shadow-[2px_2px_0_var(--shadow-color)] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_var(--shadow-color)] ${className}`}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
