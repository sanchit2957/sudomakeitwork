import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("active SOS route privacy contract", () => {
  it("binds the route destination only to the existing assigned-rescuer payload for the matched SOS code", () => {
    const source = readFileSync(new URL("./routers/rescue.ts", import.meta.url), "utf8");
    expect(source).toContain("assignedRescuer: !assigned || !profile ? null");
    expect(source).toContain("destination: { latitude: incident.latitude, longitude: incident.longitude }");
    expect(source).toContain("presentAssignedRescuerToVictim");
  });
});
