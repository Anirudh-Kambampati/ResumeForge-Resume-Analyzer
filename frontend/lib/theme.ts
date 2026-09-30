// ============================================================
// Light / dark theme
//
// The active theme lives on <html data-theme="light|dark">; globals.css
// re-points the colour variables for light mode. THEME_INIT_SCRIPT runs in
// <head> before first paint so there's no flash of the wrong theme.
// Without a saved choice, the theme follows the system setting.
// ============================================================

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "resumeforge-theme";

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})();`;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked; the theme still applies for this page view
  }
}

function hasSavedTheme(): boolean {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark";
  } catch {
    return false;
  }
}

/** Subscribe to theme changes (attribute changes + system changes when no choice is saved). */
export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onSystemChange = () => {
    if (!hasSavedTheme()) document.documentElement.dataset.theme = media.matches ? "light" : "dark";
  };
  media.addEventListener("change", onSystemChange);

  return () => {
    observer.disconnect();
    media.removeEventListener("change", onSystemChange);
  };
}
