"use client";

import * as React from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  ThemeMode,
  getNextTheme,
  resolveTheme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemeMode;
  mounted: boolean;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  mounted: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyThemeToDom(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeMode>(DEFAULT_THEME);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    let initial = DEFAULT_THEME;
    try {
      initial = resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      // Ignore storage read errors
    }
    setThemeState(initial);
    applyThemeToDom(initial);
    setMounted(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const synced = resolveTheme(event.newValue);
      setThemeState(synced);
      applyThemeToDom(synced);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTheme = React.useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors
    }
    applyThemeToDom(next);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => {
      const next = getNextTheme(prev);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Ignore storage write errors
      }
      applyThemeToDom(next);
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({ theme, mounted, setTheme, toggleTheme }),
    [theme, mounted, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
