// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { getApiBaseUrl, getApiUrl, isNativeApp, DEFAULT_PRODUCTION_API_URL } from "./apiConfig";

describe("apiConfig utility", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      delete (window as any).__APP_API_URL__;
      localStorage.removeItem("app_api_base_url");
    }
  });

  it("exports a valid default production API URL", () => {
    expect(DEFAULT_PRODUCTION_API_URL).toBe("https://assam-rescue-platform.onrender.com");
  });

  it("preserves already absolute URLs", () => {
    expect(getApiUrl("https://example.com/api/trpc")).toBe("https://example.com/api/trpc");
    expect(getApiUrl("http://localhost:3000/api")).toBe("http://localhost:3000/api");
    expect(getApiUrl("data:image/png;base64,...")).toBe("data:image/png;base64,...");
    expect(getApiUrl("blob:http://localhost/123")).toBe("blob:http://localhost/123");
  });

  it("applies runtime window.__APP_API_URL__ override when set", () => {
    (window as any).__APP_API_URL__ = "https://rescue.assam.gov.in";
    expect(getApiBaseUrl()).toBe("https://rescue.assam.gov.in");
    expect(getApiUrl("/api/trpc")).toBe("https://rescue.assam.gov.in/api/trpc");
    expect(getApiUrl("api/trpc")).toBe("https://rescue.assam.gov.in/api/trpc");
  });

  it("applies stored localStorage app_api_base_url override", () => {
    localStorage.setItem("app_api_base_url", "https://api.assamrescue.org");
    expect(getApiBaseUrl()).toBe("https://api.assamrescue.org");
    expect(getApiUrl("/api/trpc")).toBe("https://api.assamrescue.org/api/trpc");
  });

  it("reports isNativeApp boolean cleanly without throwing", () => {
    expect(typeof isNativeApp()).toBe("boolean");
  });
});

