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
    expect(localStorage.getItem("sahay-language")).toBe("hi");
    expect(document.documentElement.lang).toBe("hi");
    expect(window.location.search).toBe("?lang=hi");
  });

  it("switches seamlessly between languages and restores English in real-time without reloading", () => {
    function MultiLangProbe() {
      const { setLocale } = useLanguage();
      return (
        <div>
          <button onClick={() => setLocale("hi")}>Switch to Hindi</button>
          <button onClick={() => setLocale("as")}>Switch to Assamese</button>
          <button onClick={() => setLocale("bn")}>Switch to Bengali</button>
          <button onClick={() => setLocale("ta")}>Switch to Tamil</button>
          <button onClick={() => setLocale("en")}>Switch to English</button>
          <div data-testid="target">Sign in to activate</div>
        </div>
      );
    }

    const view = render(<LanguageProvider><MultiLangProbe /></LanguageProvider>);
    const target = view.getByTestId("target");
    expect(target.textContent).toBe("Sign in to activate");

    // 1. Switch to Hindi
    fireEvent.click(view.getByText("Switch to Hindi"));
    expect(target.textContent).toBe("सक्रिय करने के लिए साइन इन करें");

    // 2. Switch to Assamese
    fireEvent.click(view.getByText("Switch to Assamese"));
    expect(target.textContent).toBe("সক্ৰিয় কৰিবলৈ ছাইন ইন কৰক");

    // 3. Switch to Bengali
    fireEvent.click(view.getByText("Switch to Bengali"));
    expect(target.textContent).toBe("সক্রিয় করতে সাইন ইন করুন");

    // 4. Switch to Tamil
    fireEvent.click(view.getByText("Switch to Tamil"));
    expect(target.textContent).toBe("செயல்படுத்த உள்நுழையவும்");

    // 5. Switch back to English (without reloading!)
    fireEvent.click(view.getByText("Switch to English"));
    expect(target.textContent).toBe("Sign in to activate");
  });
});
