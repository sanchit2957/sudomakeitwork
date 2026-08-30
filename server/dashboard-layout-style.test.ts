import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DashboardLayout sidebar styling", () => {
  it("keeps the footer side panel opaque in expanded and collapsed states", () => {
    const source = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");

    expect(source).toContain('rounded-2xl bg-[#e9f2ee] p-2 group-data-[collapsible=icon]:bg-[#e9f2ee]');
    expect(source).not.toContain("rounded-2xl bg-secondary/70 p-2 group-data-[collapsible=icon]:bg-transparent");
  });

  it("allows Command Centre to request a permanently expanded desktop sidebar", () => {
    const layout = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
    const command = readFileSync(new URL("../client/src/pages/Command.tsx", import.meta.url), "utf8");
    const sidebar = readFileSync(new URL("../client/src/components/ui/sidebar.tsx", import.meta.url), "utf8");

    expect(layout).toContain('desktopSidebar?: "collapsible" | "fixed"');
    expect(layout).toContain('collapsible={desktopSidebar === "fixed" ? "none" : "icon"}');
    expect(command).toContain('desktopSidebar="fixed"');
    expect(sidebar.indexOf("if (isMobile)")).toBeLessThan(sidebar.indexOf('if (collapsible === "none")'));
  });
});
