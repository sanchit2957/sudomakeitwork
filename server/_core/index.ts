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
import { donationRouter } from "../routers/donations";
import { registerN8nRoutes } from "../n8n";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./vite";
import { getDatabasePoolMetrics, pingDatabase } from "../db";

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
      filter: (req: express.Request, res: express.Response) => {
        if (req.headers["x-no-compression"]) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024,
    })
  );

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  // Enable CORS with explicit production allowlist & native mobile support
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like native mobile apps, server-to-server)
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
        const allowedOrigins = [
          ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim()) : []),
          ...(process.env.APP_URL ? [process.env.APP_URL.trim()] : []),
          ...(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL.trim()] : []),
          "https://assam-rescue-platform.onrender.com",
        ].filter(Boolean);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (process.env.NODE_ENV === "production") {
          return callback(new Error("CORS origin not allowed in production"), false);
        }
        // In local development, permit the origin
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
  app.use("/api", donationRouter);
  app.use("/", donationRouter);

  // n8n webhook routes + offline SOS endpoint
  registerN8nRoutes(app);

  // Lightweight production diagnostic /health endpoint
  app.get("/health", async (_req, res) => {
    const mem = process.memoryUsage();
    const dbPing = await pingDatabase();
    const poolMetrics = getDatabasePoolMetrics();
    const isDegraded = !dbPing.ok || poolMetrics.status === "circuit_broken";

    res.status(isDegraded && process.env.NODE_ENV === "production" ? 503 : 200).json({
      status: isDegraded ? "degraded" : "ok",
      uptime: Math.floor(process.uptime()),
      memory: {
        rssMb: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
        heapUsedMb: Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10,
        heapTotalMb: Math.round((mem.heapTotal / (1024 * 1024)) * 10) / 10,
      },
      database: {
        status: dbPing.ok ? "connected" : "unreachable",
        pingLatencyMs: dbPing.latencyMs,
        pingError: dbPing.error,
        pool: poolMetrics,
      },
      version: "1.0.0",
    });
  });

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
