import { describe, expect, it } from "vitest";

describe("application identity configuration", () => {
  it("exposes the requested sudo MakeItWork project title", () => {
    expect(process.env.VITE_APP_TITLE).toBe("sudo MakeItWork");
  });
});
