import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("automatic responder location UI", () => {
  it("publishes active-mission locations every five seconds without exposing a manual sharing control", () => {
    const responder = readFileSync(new URL("./Responder.tsx", import.meta.url), "utf8");
    expect(responder).toContain("window.setInterval(publishLocation, 5_000)");
    expect(responder).toContain("Automatic mission location");
    expect(responder).toContain("Sharing automatically every 5 seconds");
    expect(responder).not.toContain("setLocationSharing");
    expect(responder).not.toContain('t("Stop sharing")');
    expect(responder).not.toContain('t("Share live location")');
  });

  it("refreshes both victim tracking surfaces every five seconds and removes manual-start copy", () => {
    const track = readFileSync(new URL("./Track.tsx", import.meta.url), "utf8");
    const trackFlow = readFileSync(new URL("./TrackFlow.tsx", import.meta.url), "utf8");
    expect(track).toContain("refetchInterval: 5_000");
    expect(trackFlow).toContain("refetchInterval: 5_000");
    expect(track).toContain("Live rescuer location · updating every 5 seconds");
    expect(track).not.toContain("The rescuer can start sharing their position");
  });
});
