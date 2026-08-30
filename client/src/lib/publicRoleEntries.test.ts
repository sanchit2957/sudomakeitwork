import { describe, expect, it } from "vitest";
import { publicRoleEntries } from "./publicRoleEntries";

describe("public emergency role entry", () => {
  it("always exposes SOS, tracking, rescuer, and command routes", () => {
    expect(publicRoleEntries.map(entry => entry.path)).toEqual(["/emergency", "/track", "/responder", "/command"]);
  });
});
