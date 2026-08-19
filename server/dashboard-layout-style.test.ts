import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DashboardLayout sidebar styling", () => {
  it("keeps the footer side panel opaque in expanded and collapsed states", () => {
    const source = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");

    expect(source).toContain('rounded-2xl bg-[#e9f2ee] p-2 group-data-[collapsible=icon]:bg-[#e9f2ee]');
    expect(source).not.toContain("rounded-2xl bg-secondary/70 p-2 group-data-[collapsible=icon]:bg-transparent");
  });
});
