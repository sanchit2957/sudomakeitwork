// @vitest-environment jsdom
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider, useLanguage } from "./LanguageContext";

function LanguageProbe() {
  const { locale, setLocale, t } = useLanguage();
  return <button onClick={() => setLocale("hi")}>{locale} · {t("Sign in to activate")} · {t("Track")}</button>;
}

describe("LanguageProvider browser persistence", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("applies the selected locale to visible current-interface copy and persists it in storage and the URL", () => {
    const view = render(<LanguageProvider><LanguageProbe /></LanguageProvider>);

    fireEvent.click(view.getByRole("button", { name: /sign in to activate/i }));

    expect(view.getByRole("button", { name: /सक्रिय करने के लिए साइन इन करें/i })).toBeTruthy();
    expect(localStorage.getItem("sudo-makeitwork-language")).toBe("hi");
    expect(document.documentElement.lang).toBe("hi");
    expect(window.location.search).toBe("?lang=hi");
  });
});
