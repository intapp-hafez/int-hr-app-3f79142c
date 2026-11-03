import React, { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "./i18n";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = "int_hr_theme";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      return stored || "light";
    } catch {
      return "light";
    }
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "dark") return true;
      if (stored === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    const applyDark = (dark: boolean) => {
      setIsDark(dark);
      if (dark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      applyDark(media.matches);
      const listener = (e: MediaQueryListEvent) => applyDark(e.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    } else {
      applyDark(theme === "dark");
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {}
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme: Theme = isDark ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "light" as Theme,
      isDark: false,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}

export function ThemeToggle({
  className = "",
}: {
  className?: string;
  compact?: boolean;
}) {
  const { isDark, toggleTheme } = useTheme();
  const { isAr } = useI18n();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        isDark
          ? isAr
            ? "التبديل إلى الوضع المضيء"
            : "Switch to light mode"
          : isAr
          ? "التبديل إلى الوضع الداكن"
          : "Switch to dark mode"
      }
      title={
        isDark
          ? isAr
            ? "الوضع المضيء"
            : "Light mode"
          : isAr
          ? "الوضع الداكن"
          : "Dark mode"
      }
      className={`relative grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-card text-foreground transition-all duration-200 hover:bg-secondary hover:scale-105 active:scale-95 cursor-pointer shadow-2xs ${className}`}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 dark:text-slate-300 transition-transform duration-300 -rotate-12 hover:rotate-0" />
      )}
    </button>
  );
}
