"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_THEME } from "@/lib/theme";
import { useTheme } from "./theme-provider";

interface ThemeToggleProps {
  variant?: "sidebar" | "compact" | "icon";
  className?: string;
}

export function ThemeToggle({ variant = "sidebar", className }: ThemeToggleProps) {
  const { theme, mounted, setTheme, toggleTheme } = useTheme();
  const effectiveTheme = mounted ? theme : DEFAULT_THEME;
  const isDark = effectiveTheme === "dark";

  const icon = isDark ? (
    <Sun className="h-4 w-4 text-amber-400 shrink-0" />
  ) : (
    <Moon className="h-4 w-4 text-sky-600 shrink-0" />
  );

  const label = isDark ? "Dark" : "Light";
  const title = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle light and dark theme"
        title={title}
        className={cn(
          "h-8 w-8 rounded-lg border bg-background/60 hover:bg-muted/60 transition-colors inline-flex items-center justify-center text-foreground",
          className
        )}
      >
        {icon}
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle light and dark theme"
        title={title}
        className={cn(
          "inline-flex items-center gap-2 h-9 px-3 rounded-lg border bg-background/80 backdrop-blur-md hover:bg-accent/70 text-foreground transition-colors text-xs font-semibold shadow-sm active:scale-[0.98]",
          className
        )}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Theme mode"
      className={cn(
        "grid grid-cols-2 gap-1 p-1 rounded-lg border bg-background/80 shadow-sm",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={!isDark}
        title="Switch to Light Mode"
        className={cn(
          "h-8 px-2.5 rounded-md inline-flex items-center justify-center gap-1.5 text-xs transition-all active:scale-[0.98]",
          !isDark
            ? "bg-primary text-primary-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium"
        )}
      >
        <Sun className="h-3.5 w-3.5 shrink-0" />
        <span>Light</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={isDark}
        title="Switch to Dark Mode"
        className={cn(
          "h-8 px-2.5 rounded-md inline-flex items-center justify-center gap-1.5 text-xs transition-all active:scale-[0.98]",
          isDark
            ? "bg-primary text-primary-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium"
        )}
      >
        <Moon className="h-3.5 w-3.5 shrink-0" />
        <span>Dark</span>
      </button>
    </div>
  );
}
