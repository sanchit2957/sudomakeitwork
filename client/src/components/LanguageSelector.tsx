import { Languages } from "lucide-react";
import { localeOptions, useLanguage } from "@/contexts/LanguageContext";

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLanguage();
  return <label className={`inline-flex items-center gap-2 rounded-xl border border-[#b8dcd2] bg-white px-2.5 py-2 text-xs font-bold text-[#255c7d] shadow-sm ${compact ? "" : "min-w-35"}`}>
    <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span className="sr-only">{t("language.label")}</span>
    <select aria-label={t("language.label")} value={locale} onChange={event => setLocale(event.target.value as typeof locale)} className="min-w-0 appearance-none bg-transparent pr-1 font-bold outline-none">
      {localeOptions.map(option => <option key={option.code} value={option.code}>{option.nativeLabel}</option>)}
    </select>
  </label>;
}
