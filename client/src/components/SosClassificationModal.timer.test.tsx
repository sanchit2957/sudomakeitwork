/**
 * @vitest-environment jsdom
 *
 * SOS CLASSIFICATION & 10-SECOND TIMER INVARIANT TESTS
 * Verifies that the cancellation and triage window is exactly 10 seconds,
 * with no legacy 15-second fallbacks.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { TRIAGE_CANCEL_WINDOW_MS } from "./SosClassificationModal";

describe("SosClassificationModal 10-Second Timer Invariants", () => {
  it("exports TRIAGE_CANCEL_WINDOW_MS as exactly 10_000 (10 seconds)", () => {
    expect(TRIAGE_CANCEL_WINDOW_MS).toBe(10_000);
  });

  it("ensures no legacy 15-second triage timer fallbacks remain in source code", () => {
    const modalPath = path.resolve(process.cwd(), "client/src/components/SosClassificationModal.tsx");
    const source = readFileSync(modalPath, "utf-8");

    expect(source).not.toContain("Date.now() + 15_000");
    expect(source).not.toContain("return 15;");
    expect(source).not.toContain("15-second");
    expect(source).toContain("TRIAGE_CANCEL_WINDOW_MS = 10_000");
  });
});
