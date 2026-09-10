import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("automatic active-mission responder location lifecycle", () => {
  it("enables sharing on assignment, accepts updates only during an open mission, and clears it on resolution", () => {
    const source = readFileSync(new URL("./routers/rescue.ts", import.meta.url), "utf8");
    expect(source).toContain('availability: "on_mission", locationSharing: "yes", lastLatitude: null, lastLongitude: null, locationUpdatedAt: null');
    expect(source).not.toContain("setLocationSharing:");
    expect(source).toContain('Live location updates are available only during an active assigned mission.');
    expect(source).toContain('availability: "available", locationSharing: "no", lastLatitude: null, lastLongitude: null, locationUpdatedAt: null');
  });
});
