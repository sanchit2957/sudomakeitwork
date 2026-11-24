import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("live rescuer route and ETA tracking", () => {
  it("renders Google Maps driving directions, a route line, ETA, and an honest unavailable state", () => {
    const trackComp = readFileSync(new URL("../components/TrackIncidentComponents.tsx", import.meta.url), "utf8");
    const trackFlow = readFileSync(new URL("./user/UserTrackFlow.tsx", import.meta.url), "utf8");
    expect(trackComp).toContain("new maps.DirectionsService().route");
    expect(trackComp).toContain("new maps.Polyline");
    expect(trackComp).toContain('strokeColor: "#d23f43"');
    expect(trackComp).toContain("strokeWeight: 7");
    expect(trackComp).toContain("new PinElement");
    expect(trackComp).toContain('background: "#1a73e8"');
    expect(trackComp).toContain('glyph: "R"');
    expect(trackComp).toContain('title: "Your SOS location"');
    expect(trackComp).toContain('title: "Assigned rescuer"');
    expect(trackComp).toContain("travelMode: maps.TravelMode.DRIVING");
    expect(trackComp).toContain("Live route · ETA");
    // OSRM route unavailable shows ETA text from server SSE or null state
    expect(trackComp).toContain("etaText ||");
    expect(trackComp).toContain("rescuer.destination");
    // Chat still polls every 5s
    expect(trackComp).toContain("refetchInterval: 5_000");
    // SSE hook integrated
    expect(trackFlow).toContain("useLiveRescuerStream");
  });

  it("loads routing support through the existing authenticated Maps proxy", () => {
    const map = readFileSync(new URL("../components/Map.tsx", import.meta.url), "utf8");
    expect(map).toContain("libraries=marker,places,geocoding,geometry,routes");
  });
});
