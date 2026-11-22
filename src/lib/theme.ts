export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "coremenu-theme";
export const DEFAULT_THEME: ThemeMode = "dark";

export function resolveTheme(stored: string | null | undefined): ThemeMode {
  if (stored === "light") return "light";
  if (stored === "dark") return "dark";
  return DEFAULT_THEME;
}

export function getNextTheme(current: ThemeMode): ThemeMode {
  return current === "dark" ? "light" : "dark";
}

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});var d=t!=="light";var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
