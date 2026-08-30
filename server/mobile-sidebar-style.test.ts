import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile workspace sidebar styling", () => {
  it("uses an opaque, high-contrast drawer and preserves passed workspace styling", () => {
    const source = readFileSync(new URL("../client/src/components/ui/sidebar.tsx", import.meta.url), "utf8");

    expect(source).toContain('"w-(--sidebar-width) border-r border-[#b8dcd2] bg-[#f7fbf9] p-0 text-[#173d37] shadow-2xl [&>button]:hidden"');
    expect(source).toContain("className={cn(");
    expect(source).not.toContain('className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"');
  });
});
