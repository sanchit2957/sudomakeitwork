import { describe, expect, it } from "vitest";
import { canHandleSafetyAssistance, canTransitionSafetyAssistance, isSafetyRequestOwnedBy, visibleSafetyCategoriesForRole } from "./safety-assistance.policy";

describe("safety assistance handling policy", () => {
  it("allows government and field responders to handle every safety category", () => {
    for (const category of ["shelter", "food", "medical", "protection"] as const) {
      expect(canHandleSafetyAssistance("admin", category)).toBe(true);
      expect(canHandleSafetyAssistance("rescuer", category)).toBe(true);
    }
  });

  it("limits hospital and medical staff to medical assistance", () => {
    expect(canHandleSafetyAssistance("hospital", "medical")).toBe(true);
    expect(canHandleSafetyAssistance("hospital", "shelter")).toBe(false);
    expect(canHandleSafetyAssistance("hospital", "food")).toBe(false);
    expect(canHandleSafetyAssistance("hospital", "protection")).toBe(false);
    expect(canHandleSafetyAssistance("medical", "medical")).toBe(true);
  });

  it("permits only an auditable new-to-acknowledged-to-resolved workflow", () => {
    expect(canTransitionSafetyAssistance("new", "acknowledged")).toBe(true);
    expect(canTransitionSafetyAssistance("acknowledged", "resolved")).toBe(true);
    expect(canTransitionSafetyAssistance("new", "resolved")).toBe(false);
    expect(canTransitionSafetyAssistance("acknowledged", "acknowledged")).toBe(false);
    expect(canTransitionSafetyAssistance("resolved", "resolved")).toBe(false);
  });

  it("filters hospital and medical queues to medical requests while government and field queues can see every category", () => {
    expect(visibleSafetyCategoriesForRole("hospital")).toEqual(["medical"]);
    expect(visibleSafetyCategoriesForRole("medical")).toEqual(["medical"]);
    expect(visibleSafetyCategoriesForRole("admin")).toEqual(["shelter", "food", "medical", "protection"]);
    expect(visibleSafetyCategoriesForRole("rescuer")).toEqual(["shelter", "food", "medical", "protection"]);
  });

  it("treats a victim Safety request as owned only by the account that created it", () => {
    expect(isSafetyRequestOwnedBy(42, 42)).toBe(true);
    expect(isSafetyRequestOwnedBy(42, 99)).toBe(false);
  });
});
