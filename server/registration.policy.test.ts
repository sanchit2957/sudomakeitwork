import { describe, expect, it } from "vitest";
import { canRequestRescuerRegistration, requiresCallSign } from "./registration.policy";

describe("rescuer registration policy", () => {
  it("allows ordinary accounts to request field authorization but prevents role escalation by responders and administrators", () => {
    expect(canRequestRescuerRegistration("user")).toBe(true);
    expect(canRequestRescuerRegistration("rescuer")).toBe(false);
    expect(canRequestRescuerRegistration("admin")).toBe(false);
  });

  it("requires an administrator call sign for approval", () => {
    expect(requiresCallSign("approved", "NDRF-12")).toBe(true);
    expect(requiresCallSign("approved")).toBe(false);
    expect(requiresCallSign("rejected")).toBe(true);
  });
});
