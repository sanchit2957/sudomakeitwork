import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("dark theme coverage", () => {
  it("applies the shared Victim dark surface wrapper to every public subpage", () => {
    for (const path of ["../client/src/pages/Home.tsx", "../client/src/pages/Safety.tsx", "../client/src/pages/More.tsx", "../client/src/pages/TrackFlow.tsx"]) {
      const page = source(path);
      expect(page).toContain("victim-page");
      expect(page).toContain("victim-main");
    }
  });

  it("protects hard-coded public and workspace cards, text, borders, and controls in dark mode", () => {
    const css = source("../client/src/index.css");
    expect(css).toContain('.dark .victim-page :is([class~="bg-white"], [class~="bg-card"]');
    expect(css).toContain('.dark .workspace-surface :is([class~="bg-white"], [class~="bg-card"]');
    expect(css).toContain('.dark .victim-page [class*="text-[#"]');
    expect(css).toContain('.dark .workspace-surface [class*="border-[#"]');
    expect(css).toContain("button, a, input, select, textarea):focus-visible");
  });

  it("keeps dark-mode fallbacks readable in maps and protected access", () => {
    expect(source("../client/src/components/Map.tsx")).toContain("dark:bg-[#202023]");
    expect(source("../client/src/components/OperationsMap.tsx")).toContain("dark:bg-[#1a1a1c]/95");
    expect(source("../client/src/components/RoleGate.tsx")).toContain("dark:bg-[#242426] dark:text-[#d4d4d8]");
    expect(source("../client/src/components/DashboardLayout.tsx")).toContain("dark:bg-[#28282d] dark:text-[#f4f4f5]");
    expect(source("../client/src/components/PlatformLoginDialog.tsx")).toContain("dark:border-[#424248] dark:bg-[#1a1a1c] dark:text-[#f4f4f5]");
  });
});
