import { describe, expect, it } from "vitest";
import { canEditHospitalResources, canRequestHospitalRegistration } from "./hospital-registration.policy";

describe("hospital registration and ownership policy", () => {
  it("allows only a standard account to request approval as hospital staff", () => {
    expect(canRequestHospitalRegistration("user")).toBe(true);
    expect(canRequestHospitalRegistration("medical")).toBe(false);
    expect(canRequestHospitalRegistration("rescuer")).toBe(false);
    expect(canRequestHospitalRegistration("admin")).toBe(false);
  });

  it("allows administrators to update any hospital but scopes medical staff to their approved hospital", () => {
    expect(canEditHospitalResources("admin", null, 12)).toBe(true);
    expect(canEditHospitalResources("medical", 12, 12)).toBe(true);
    expect(canEditHospitalResources("medical", 12, 13)).toBe(false);
    expect(canEditHospitalResources("medical", null, 12)).toBe(false);
  });
});
