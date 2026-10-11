// ============================================================
// Paper / Night desk theme
//
// The active theme lives on <html data-theme="light|dark">; globals.css
// defines paper (light) as the default and re-points the colour
// variables for Night desk (dark). THEME_INIT_SCRIPT runs in <head>
// before first paint so there's no flash of the wrong theme.
// Paper is the default: without a saved choice the site starts light.
// ============================================================

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "resumeforge-theme";

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})();`;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked; the theme still applies for this page view
  }
}

/** Subscribe to theme changes made by the toggle (or another tab's init). */
export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
