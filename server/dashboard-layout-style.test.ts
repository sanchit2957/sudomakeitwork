import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DashboardLayout sidebar styling", () => {
  it("keeps the footer side panel opaque in expanded and collapsed states", () => {
    const source = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");

    expect(source).toContain('rounded-2xl bg-[#e9f2ee] p-2 group-data-[collapsible=icon]:bg-[#e9f2ee]');
    expect(source).not.toContain("rounded-2xl bg-secondary/70 p-2 group-data-[collapsible=icon]:bg-transparent");
  });

  it("keeps desktop navigation available as an icon rail with an in-sidebar expand control", () => {
    const source = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");

    expect(source).toContain('<Sidebar collapsible="icon" className="border-r border-r-border bg-[#f7fbf9]">');
    expect(source).toContain('SidebarTrigger className="hidden h-9 w-9 shrink-0 md:inline-flex group-data-[collapsible=icon]:hidden"');
  });
});
