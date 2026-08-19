import { describe, expect, it } from "vitest";
import { planRoleSync } from "./db";

describe("user role synchronization", () => {
  it("creates a first-time project owner as an administrator without overwriting an existing role", () => {
    expect(planRoleSync(undefined, true)).toEqual({ insertRole: "admin", updateRole: undefined });
  });

  it("preserves an explicitly authorized rescuer role on later syncs", () => {
    expect(planRoleSync("rescuer", true)).toEqual({ insertRole: "rescuer", updateRole: "rescuer" });
  });

  it("does not introduce a role for an ordinary first-time user", () => {
    expect(planRoleSync(undefined, false)).toEqual({ insertRole: undefined, updateRole: undefined });
  });
});
