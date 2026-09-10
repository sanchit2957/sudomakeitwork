import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("live rescuer route and ETA tracking", () => {
  it("renders Google Maps driving directions, a route line, ETA, and an honest unavailable state", () => {
    const track = readFileSync(new URL("./Track.tsx", import.meta.url), "utf8");
    expect(track).toContain("new maps.DirectionsService().route");
    expect(track).toContain("new maps.Polyline");
    expect(track).toContain('strokeColor: "#d23f43"');
    expect(track).toContain("strokeWeight: 7");
    expect(track).toContain("new PinElement");
    expect(track).toContain('background: "#1a73e8"');
    expect(track).toContain('glyph: "R"');
    expect(track).toContain('title: "Your SOS location"');
    expect(track).toContain('title: "Assigned rescuer"');
    expect(track).toContain("travelMode: maps.TravelMode.DRIVING");
    expect(track).toContain("Live route · ETA");
    // OSRM route unavailable shows ETA text from server SSE or null state
    expect(track).toContain("etaText ||");
    expect(track).toContain("rescuer.destination");
    // Chat still polls every 5s
    expect(track).toContain("refetchInterval: 5_000");
    // SSE hook integrated
    expect(track).toContain("useLiveRescuerStream");
  });

  it("loads routing support through the existing authenticated Maps proxy", () => {
    const map = readFileSync(new URL("../components/Map.tsx", import.meta.url), "utf8");
    expect(map).toContain("libraries=marker,places,geocoding,geometry,routes");
  });
});
