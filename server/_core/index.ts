import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable gzip/deflate compression for massive bandwidth & buffer reduction
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024,
    })
  );

  // Enable CORS for native mobile apps (Capacitor) and cross-origin clients
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        // Allow Capacitor local origins and localhost
        if (
          origin === "capacitor://localhost" ||
          origin === "https://localhost" ||
          origin === "http://localhost" ||
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:") ||
          origin.startsWith("http://10.0.2.2:") // Android emulator host alias
        ) {
          return callback(null, true);
        }
        // Check configured explicit allowed origins
        const configuredOrigins = process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
          : [];
        if (configuredOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (process.env.NODE_ENV === "production" && configuredOrigins.length > 0) {
          return callback(new Error("CORS origin not allowed"), false);
        }
        // In local development or default web server, permit the origin
        return callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Cache-Control",
        "Pragma",
      ],
    })
  );

  // Configure body parser with bounded size limit for file uploads
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "client/public/uploads")));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // tRPC API
  app.use("/api/trpc", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode dynamically imports Vite; production mode serves pre-built static assets
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/ (NODE_ENV=${process.env.NODE_ENV || "production"})`);
  });
}

startServer().catch(console.error);
