import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { localeOptions, resolveLocale, translate } from "./LanguageContext";

describe("platform language support", () => {
  it("offers ten high-use Indian language choices with unique locale codes", () => {
    expect(localeOptions).toHaveLength(10);
    expect(new Set(localeOptions.map(option => option.code)).size).toBe(10);
    expect(localeOptions.map(option => option.code)).toEqual(["en", "as", "hi", "bn", "or", "mr", "gu", "ta", "te", "kn"]);
  });

  it("resolves supported locales, localizes core SOS text, and falls back safely to English", () => {
    expect(resolveLocale("ta")).toBe("ta");
    expect(resolveLocale("unsupported")).toBe("en");
    expect(translate("as", "emergency.send")).toBe("এতিয়াই SOS পঠিয়াওক");
    expect(translate("te", "command.requests")).toBe("స్పందనకర్త అభ్యర్థనలు");
    expect(translate("bn", "home.capacityCopy")).toBe(translate("en", "home.capacityCopy"));
    expect(translate("ta", "Field readiness", undefined, { ta: { "Field readiness": "கள தயார் நிலை" } })).toBe("கள தயார் நிலை");
  });

  it("provides visible core emergency and operations labels for every supported locale", () => {
    for (const { code } of localeOptions) {
      expect(translate(code, "home.heading")).not.toBe("home.heading");
      expect(translate(code, "emergency.pictureHint")).not.toBe("emergency.pictureHint");
      expect(translate(code, "emergency.send")).not.toBe("emergency.send");
      expect(translate(code, "responder.missions")).not.toBe("responder.missions");
      expect(translate(code, "command.requests")).not.toBe("command.requests");
    }
  });

  it("resolves managed mission and Command Centre approval labels for every supported locale", () => {
    const operationalTerms = Object.fromEntries(localeOptions.map(({ code }) => [code, {
      "Mark dispatched": `${code}-dispatch`,
      "Approve rescuer": `${code}-approve`,
      Assign: `${code}-assign`,
      "The alert worker is still starting. Wait a few seconds, refresh this page, and try again.": `${code}-push-recovery`,
    }]));
    for (const { code } of localeOptions) {
      expect(translate(code, "Mark dispatched", undefined, operationalTerms)).toBe(`${code}-dispatch`);
      expect(translate(code, "Approve rescuer", undefined, operationalTerms)).toBe(`${code}-approve`);
      expect(translate(code, "Assign", undefined, operationalTerms)).toBe(`${code}-assign`);
      expect(translate(code, "The alert worker is still starting. Wait a few seconds, refresh this page, and try again.", undefined, operationalTerms)).toBe(`${code}-push-recovery`);
    }
  });

  it("persists selection and updates the document language through the provider", () => {
    const source = readFileSync(new URL("./LanguageContext.tsx", import.meta.url), "utf8");
    expect(source).toContain('localStorage.setItem(storageKey, locale)');
    expect(source).toContain('document.documentElement.lang = locale');
    expect(source).toContain('/manus-storage/operational-language-pack_86163712.json');
    expect(source).toContain('data-no-operational-translation');
  });
});
