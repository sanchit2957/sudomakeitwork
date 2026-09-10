import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Track flow case-number display", () => {
  it("renders the stored SOS public code as a visible, accessible tracking number without changing the rescue flow contract", () => {
    const source = readFileSync(new URL("./TrackFlow.tsx", import.meta.url), "utf8");
    expect(source).toContain('aria-label="SOS tracking number"');
    expect(source).toContain("Tracking no.");
    expect(source).toContain("{status.data.publicCode}");
    expect(source).toContain("<IncidentChat publicCode={status.data.publicCode}");
  });
});
