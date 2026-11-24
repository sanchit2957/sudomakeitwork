import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("automatic responder location UI", () => {
  it("publishes active-mission locations via watchPosition without exposing a manual sharing control", () => {
    const responder = readFileSync(new URL("./user/UserResponder.tsx", import.meta.url), "utf8");
    // Upgraded to watchPosition-based continuous tracking
    expect(responder).toContain("watchPosition");
    expect(responder).toContain("hasActiveMission");
    // No manual sharing toggle
    expect(responder).not.toContain("setLocationSharing");
    expect(responder).not.toContain('t("Stop sharing")');
    expect(responder).not.toContain('t("Share live location")');
  });

  it("uses SSE-powered live tracking with polling fallback and removes manual-start copy", () => {
    const track = readFileSync(new URL("./user/UserTrackFlow.tsx", import.meta.url), "utf8");
    const trackComp = readFileSync(new URL("../components/TrackIncidentComponents.tsx", import.meta.url), "utf8");
    // Track page uses SSE hook (useLiveRescuerStream) for real-time updates
    expect(track).toContain("useLiveRescuerStream");
    // Polling fallback interval when SSE is down
    expect(track).toContain("pollingIntervalMs");
    // Chat still polls every 5s
    expect(trackComp).toContain("refetchInterval: 5_000");
    // Live GPS label shown dynamically
    expect(trackComp).toContain("Live GPS");
    // No old manual-start copy
    expect(trackComp).not.toContain("The rescuer can start sharing their position");
  });
});
