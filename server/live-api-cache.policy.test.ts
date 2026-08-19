import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("live operational API cache policy", () => {
  it("marks tRPC responses as private and non-cacheable", () => {
    const server = projectFile("./_core/index.ts");

    expect(server).toContain('app.use("/api/trpc", (_req, res, next) => {');
    expect(server).toContain('res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0")');
    expect(server).toContain('res.setHeader("Pragma", "no-cache")');
  });

  it("makes tRPC client fetches bypass browser and intermediary caches", () => {
    const client = projectFile("../client/src/main.tsx");

    expect(client).toContain('cache: "no-store"');
    expect(client).toContain('"Cache-Control": "no-cache, no-store, max-age=0"');
    expect(client).toContain('Pragma: "no-cache"');
  });

  it("never serves API requests from the offline app-shell cache", () => {
    const serviceWorker = projectFile("../client/public/sw.js");

    expect(serviceWorker).toContain('const CACHE = "sudo-makeitwork-offline-shell-v2"');
    expect(serviceWorker).toContain('if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;');
    expect(serviceWorker).toContain('key.startsWith("rescue-offline-shell-") || key.startsWith("sudo-makeitwork-offline-shell-")');
  });
});
