export type AssignmentProfileForVictim = {
  callSign: string;
  name: string | null;
  photoUrl: string | null;
  phone: string | null;
  contactSharing: "yes" | "no";
  locationSharing: "yes" | "no";
  lastLatitude: number | null;
  lastLongitude: number | null;
  locationUpdatedAt: Date | null;
};

const liveLocationMaxAgeMs = 120_000;

export function presentAssignedRescuerToVictim(profile: AssignmentProfileForVictim, now = Date.now()) {
  const isFresh = profile.locationSharing === "yes"
    && profile.lastLatitude !== null
    && profile.lastLongitude !== null
    && profile.locationUpdatedAt !== null
    && now - profile.locationUpdatedAt.getTime() <= liveLocationMaxAgeMs;
  return {
    callSign: profile.callSign,
    name: profile.name,
    photoUrl: profile.photoUrl,
    phone: profile.contactSharing === "yes" ? profile.phone : null,
    locationStatus: isFresh ? "live" as const : profile.locationSharing === "yes" ? "paused" as const : "off" as const,
    location: isFresh ? { latitude: profile.lastLatitude!, longitude: profile.lastLongitude!, updatedAt: profile.locationUpdatedAt! } : null,
  };
}

export function mayShareLiveMissionLocation(hasOpenMission: boolean, enabled: boolean) {
  return hasOpenMission && enabled;
}
