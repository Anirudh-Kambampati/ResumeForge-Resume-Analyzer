"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { getTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";

/** Sun/moon button that switches between light and dark mode. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  // Server render assumes dark; the real theme is read after hydration.
  const theme = useSyncExternalStore<Theme>(subscribeTheme, getTheme, () => "dark");
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 transition hover:bg-white/[0.06] hover:text-white ${className}`}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
