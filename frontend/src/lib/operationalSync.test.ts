import { describe, expect, it } from "vitest";
import { markIncidentDispatched, reconcileAvailability, reconcileMissionStatus } from "./operationalSync";

describe("operational synchronization helpers", () => {
  it("updates an assigned incident immediately while preserving unrelated cases", () => {
    const rows = [{ incident: { id: 1, status: "pending" } }, { incident: { id: 2, status: "pending" } }];
    expect(markIncidentDispatched(rows, 2)).toEqual([{ incident: { id: 1, status: "pending" } }, { incident: { id: 2, status: "dispatched" } }]);
  });

  it("reconciles responder mission and incident status together", () => {
    const rows = [{ mission: { id: 9, status: "pending" }, incident: { status: "pending" } }];
    expect(reconcileMissionStatus(rows, 9, "dispatched")).toEqual([{ mission: { id: 9, status: "dispatched" }, incident: { status: "dispatched" } }]);
  });

  it("reconciles responder availability before server refresh confirmation", () => {
    expect(reconcileAvailability({ availability: "off_duty", callSign: "NDRF-2" }, "available")).toEqual({ availability: "available", callSign: "NDRF-2" });
  });
});
