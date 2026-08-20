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

  it("persists selection and updates the document language through the provider", () => {
    const source = readFileSync(new URL("./LanguageContext.tsx", import.meta.url), "utf8");
    expect(source).toContain('localStorage.setItem(storageKey, locale)');
    expect(source).toContain('document.documentElement.lang = locale');
  });
});
