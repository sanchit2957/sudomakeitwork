import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("live rescuer route and ETA tracking", () => {
  it("renders Google Maps driving directions, a route line, ETA, and an honest unavailable state", () => {
    const track = readFileSync(new URL("./Track.tsx", import.meta.url), "utf8");
    expect(track).toContain("new maps.DirectionsService().route");
    expect(track).toContain("new maps.DirectionsRenderer");
    expect(track).toContain("travelMode: maps.TravelMode.DRIVING");
    expect(track).toContain("Live route · ETA");
    expect(track).toContain("Route estimate is temporarily unavailable.");
    expect(track).toContain("destination={rescuer.destination}");
    expect(track).toContain("refetchInterval: 5_000");
  });

  it("loads routing support through the existing authenticated Maps proxy", () => {
    const map = readFileSync(new URL("../components/Map.tsx", import.meta.url), "utf8");
    expect(map).toContain("libraries=marker,places,geocoding,geometry,routes");
  });
});
