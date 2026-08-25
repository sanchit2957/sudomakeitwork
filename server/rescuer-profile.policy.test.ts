import { describe, expect, it } from "vitest";
import { presentAssignedRescuerToVictim } from "./rescuer-profile.policy";

const now = new Date("2026-08-20T10:45:00.000Z");
const assigned = {
  callSign: "Boat 4",
  name: "Rescue Volunteer",
  photoUrl: "/storage/rescuer-photo.png",
  phone: "+919999999999",
  contactSharing: "yes" as const,
  locationSharing: "yes" as const,
  lastLatitude: 26.1445,
  lastLongitude: 91.7362,
  locationUpdatedAt: new Date(now.getTime() - 30_000),
};

describe("assigned rescuer privacy policy", () => {
  it("exposes contact and a fresh location only for an opted-in active assignment payload", () => {
    expect(presentAssignedRescuerToVictim(assigned, now.getTime())).toMatchObject({
      callSign: "Boat 4",
      phone: "+919999999999",
      locationStatus: "live",
      location: { latitude: 26.1445, longitude: 91.7362 },
    });
  });

  it("hides a phone number when the rescuer has not consented to contact sharing", () => {
    expect(presentAssignedRescuerToVictim({ ...assigned, contactSharing: "no" }, now.getTime()).phone).toBeNull();
  });

  it("never returns stale coordinates as live after an automatic active-mission update stops", () => {
    const stale = presentAssignedRescuerToVictim({ ...assigned, locationUpdatedAt: new Date(now.getTime() - 120_001) }, now.getTime());
    expect(stale).toMatchObject({ locationStatus: "paused", location: null });
  });
});
