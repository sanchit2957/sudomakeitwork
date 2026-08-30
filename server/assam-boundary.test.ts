import { describe, expect, it } from "vitest";
import { ASSAM_BOUNDARY, ASSAM_CENTER, ASSAM_MAP_BOUNDS, isPointInAssam } from "../shared/assam-boundary";

describe("Assam geographic boundary", () => {
  it("contains the Assam operating centre and excludes nearby out-of-state and distant points", () => {
    expect(ASSAM_BOUNDARY.length).toBeGreaterThan(100);
    expect(isPointInAssam(ASSAM_CENTER.lat, ASSAM_CENTER.lng)).toBe(true);
    expect(isPointInAssam(25.5788, 91.8933)).toBe(false); // Shillong, Meghalaya
    expect(isPointInAssam(28.6139, 77.209)).toBe(false); // New Delhi
  });

  it("uses a finite Assam map camera envelope", () => {
    expect(ASSAM_MAP_BOUNDS.north).toBeGreaterThan(ASSAM_MAP_BOUNDS.south);
    expect(ASSAM_MAP_BOUNDS.east).toBeGreaterThan(ASSAM_MAP_BOUNDS.west);
  });
});
