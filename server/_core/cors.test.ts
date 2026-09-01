/**
 * CORS SECURITY & NORMALIZED ORIGIN MATCHER TESTS
 * Validates exact allowlist matching, rejection of evil subdomains, prefix attacks,
 * and malicious origin reflection.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isOriginAllowed, normalizeOrigin, getAuthorizedOrigins } from "./cors";

describe("CORS Security & Origin Validation", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("permits null or empty origin (native mobile apps, server-to-server)", () => {
    expect(isOriginAllowed(null)).toBe(true);
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed("null")).toBe(true);
    expect(isOriginAllowed("")).toBe(true);
  });

  it("permits canonical production onrender.com domain", () => {
    expect(isOriginAllowed("https://assam-rescue-platform.onrender.com")).toBe(true);
    expect(isOriginAllowed("https://assam-rescue-platform.onrender.com/")).toBe(true);
  });

  it("permits registered native app origins", () => {
    expect(isOriginAllowed("capacitor://localhost")).toBe(true);
    expect(isOriginAllowed("ionic://localhost")).toBe(true);
    expect(isOriginAllowed("https://localhost")).toBe(true);
    expect(isOriginAllowed("http://localhost")).toBe(true);
    expect(isOriginAllowed("android-app://gov.in.assamrescue.app")).toBe(true);
  });

  it("strictly REJECTS malicious subdomain attacks on onrender.com", () => {
    expect(isOriginAllowed("https://evil.onrender.com")).toBe(false);
    expect(isOriginAllowed("https://fake-assam.onrender.com")).toBe(false);
    expect(isOriginAllowed("https://attacker.onrender.com")).toBe(false);
  });

  it("strictly REJECTS prefix/suffix domain masquerading attacks", () => {
    expect(isOriginAllowed("https://assam-rescue-platform.onrender.com.attacker.example")).toBe(false);
    expect(isOriginAllowed("https://evilassam-rescue-platform.onrender.com")).toBe(false);
    expect(isOriginAllowed("http://assam-rescue-platform.onrender.com.evil.com")).toBe(false);
  });

  it("strictly REJECTS arbitrary origins in production", () => {
    expect(isOriginAllowed("https://evil-hacker.com")).toBe(false);
    expect(isOriginAllowed("https://google.com")).toBe(false);
  });

  it("normalizes origin strings cleanly", () => {
    expect(normalizeOrigin("  HTTPS://ASSAM-RESCUE-PLATFORM.ONRENDER.COM/  ")).toBe(
      "https://assam-rescue-platform.onrender.com"
    );
    expect(normalizeOrigin(null)).toBe(null);
  });
});
