import { describe, expect, it } from "vitest";
import { buildEmergencySmsUri, formatEmergencySmsText, ASSAM_EMERGENCY_NUMBERS } from "./emergencyDispatch";

describe("emergencyDispatch cellular radio SMS utility", () => {
  it("formats standard emergency SMS message with GPS and incident code", () => {
    const text = formatEmergencySmsText({
      publicCode: "SOS-8K2N9X1Y",
      latitude: 26.1445,
      longitude: 91.7362,
      emergencyType: "flood",
      peopleAffected: 4,
      locationLabel: "Silchar Flood Point",
      notes: "Trapped on roof",
    });

    expect(text).toContain("SAHAY SOS [SOS-8K2N9X1Y]");
    expect(text).toContain("LOC:26.14450,91.73620");
    expect(text).toContain("TYPE:FLOOD");
    expect(text).toContain("PEOPLE:4");
    expect(text).toContain("Silchar Flood Point");
  });

  it("builds valid sms: URI targeting 112 National Emergency", () => {
    const uri = buildEmergencySmsUri({
      latitude: 26.1921,
      longitude: 91.7543,
      emergencyType: "medical",
      peopleAffected: 2,
    });

    expect(uri.startsWith("sms:112")).toBe(true);
    expect(uri).toContain("body=");
    expect(decodeURIComponent(uri)).toContain("LOC:26.19210,91.75430");
    expect(decodeURIComponent(uri)).toContain("TYPE:MEDICAL");
  });

  it("exposes official emergency numbers", () => {
    expect(ASSAM_EMERGENCY_NUMBERS.nationalEmergency).toBe("112");
    expect(ASSAM_EMERGENCY_NUMBERS.stateEmergencyOperationsCentre).toBe("1070");
    expect(ASSAM_EMERGENCY_NUMBERS.districtEmergencyOperationsCentre).toBe("1077");
  });
});
