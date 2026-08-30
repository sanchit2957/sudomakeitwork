import { describe, expect, it } from "vitest";
import { hasValidHospitalCapacity } from "./hospital.policy";

describe("hospital capacity validation", () => {
  it("accepts availability values within declared capacity", () => {
    expect(hasValidHospitalCapacity(80, 16, 12, 3)).toBe(true);
  });

  it("rejects resource availability greater than the declared capacity", () => {
    expect(hasValidHospitalCapacity(20, 21, 5, 6)).toBe(false);
  });
});
