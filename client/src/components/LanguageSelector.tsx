import React from "react";
import { Languages, Moon, Sun } from "lucide-react";
import { localeOptions, useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const nextThemeLabel = theme === "dark" ? t("Switch to light theme") : t("Switch to dark theme");
  return (
    <div className="inline-flex items-center gap-2" data-no-operational-translation="true">
      <label
        data-no-operational-translation="true"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 ${
          compact ? "" : "min-w-35"
        }`}
      >
        <Languages className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
        <span className="sr-only">{t("language.label")}</span>
        <select
          data-no-operational-translation="true"
          aria-label={t("language.label")}
          value={locale}
          onChange={(event) => setLocale(event.target.value as any)}
          className="min-w-0 appearance-none bg-transparent pr-1 font-semibold text-xs outline-none cursor-pointer"
        >
          {localeOptions.map((option) => (
            <option key={option.code} value={option.code} data-no-operational-translation="true">
              {option.nativeLabel}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={nextThemeLabel}
        aria-pressed={theme === "dark"}
        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-xs transition active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        title={nextThemeLabel}
      >
        {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
