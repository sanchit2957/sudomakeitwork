import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";

export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import("vite");
  const viteConfigModule = await import("../../vite.config");
  const viteConfig = viteConfigModule.default;

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  const candidateTemplatePaths = [
    path.resolve(import.meta.dirname, "../..", "client", "index.html"),
    path.resolve(process.cwd(), "client", "index.html"),
    path.resolve(process.cwd(), "index.html"),
  ];

  let resolvedTemplatePath = candidateTemplatePaths.find(p => fs.existsSync(p)) || candidateTemplatePaths[0];
  let inMemoryTemplate = "";

  try {
    if (fs.existsSync(resolvedTemplatePath)) {
      inMemoryTemplate = fs.readFileSync(resolvedTemplatePath, "utf-8");
    }
  } catch (err) {
    console.warn("[Vite] Warning: initial template pre-load deferred:", (err as Error)?.message);
  }

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    // Only handle GET/HEAD requests for SPA fallback; let non-GET and API routes pass through
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }

    const url = req.originalUrl;

    try {
      // Re-resolve candidate if the previous path is unavailable
      if (!fs.existsSync(resolvedTemplatePath)) {
        const found = candidateTemplatePaths.find(p => fs.existsSync(p));
        if (found) resolvedTemplatePath = found;
      }

      let template = inMemoryTemplate;
      if (fs.existsSync(resolvedTemplatePath)) {
        try {
          template = await fs.promises.readFile(resolvedTemplatePath, "utf-8");
          inMemoryTemplate = template;
        } catch {
          // If Windows encounters a transient lock or ENOENT, fallback safely to cached template
          if (!template) {
            template = inMemoryTemplate;
          }
        }
      }

      if (!template) {
        throw new Error(
          `Unable to load index.html from any candidate location: ${candidateTemplatePaths.join(", ")}`
        );
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const possiblePaths = [
    path.resolve(import.meta.dirname, "public"),
    path.resolve(import.meta.dirname, "../dist/public"),
    path.resolve(import.meta.dirname, "../../dist/public"),
    path.resolve(process.cwd(), "dist", "public"),
  ];
  const distPath = possiblePaths.find(p => fs.existsSync(p)) || path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(
    express.static(distPath, {
      maxAge: "1d",
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
        }
      },
    })
  );

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
