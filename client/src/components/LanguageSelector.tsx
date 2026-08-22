import { Languages, Moon, Sun } from "lucide-react";
import { localeOptions, useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const nextThemeLabel = theme === "dark" ? t("Switch to light theme") : t("Switch to dark theme");
  return <div className="inline-flex items-center gap-2"><label className={`inline-flex items-center gap-2 rounded-xl border border-[#b8dcd2] bg-white px-2.5 py-2 text-xs font-bold text-[#255c7d] shadow-sm transition-colors dark:border-[#46766b] dark:bg-[#18342f] dark:text-[#d8f2e9] ${compact ? "" : "min-w-35"}`}>
    <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span className="sr-only">{t("language.label")}</span>
    <select aria-label={t("language.label")} value={locale} onChange={event => setLocale(event.target.value as typeof locale)} className="min-w-0 appearance-none bg-transparent pr-1 font-bold outline-none">
      {localeOptions.map(option => <option key={option.code} value={option.code}>{option.nativeLabel}</option>)}
    </select>
  </label><button type="button" onClick={toggleTheme} aria-label={nextThemeLabel} aria-pressed={theme === "dark"} className="grid h-9 w-9 place-items-center rounded-xl border border-[#b8dcd2] bg-white text-[#255c7d] shadow-sm transition active:scale-95 dark:border-[#46766b] dark:bg-[#18342f] dark:text-[#f4d98b]" title={nextThemeLabel}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button></div>;
}
