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
import { liveTrackingRouter } from "../tracking/liveStream";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./vite";
import { getDatabasePoolMetrics, pingDatabase, runDatabaseForensicBenchmark } from "../db";
import { isOriginAllowed } from "./cors";

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

  // Enable secure CORS with exact normalized allowlist matching
  const corsHandler = cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
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
      "X-Webhook-Secret",
    ],
  });

  app.use(corsHandler);
  app.options("*", corsHandler);

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

  // Real-time SSE Live Tracking stream
  app.use(liveTrackingRouter);

  // Minimal public production health check endpoint (Render compatible)
  app.get("/health", async (_req, res) => {
    const dbPing = await pingDatabase();
    const poolMetrics = getDatabasePoolMetrics();

    // Three-tier status: healthy / degraded / unhealthy
    let dbStatus: "healthy" | "degraded" | "unhealthy";
    if (dbPing.ok && poolMetrics.consecutiveFailures === 0) {
      dbStatus = "healthy";
    } else if (dbPing.ok || poolMetrics.consecutiveFailures < 5) {
      dbStatus = "degraded";
    } else {
      dbStatus = "unhealthy";
    }

    const appStatus = dbStatus === "unhealthy" ? "degraded" : "ok";
    const httpStatus = dbStatus === "unhealthy" && process.env.NODE_ENV === "production" ? 503 : 200;

    res.status(httpStatus).json({
      status: appStatus,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      db: {
        status: dbStatus,
        pingLatencyMs: dbPing.latencyMs,
        errorCode: dbPing.code ?? null,
        consecutiveFailures: poolMetrics.consecutiveFailures,
        lastErrorCode: poolMetrics.lastErrorCode ?? null,
        lastSuccessfulQuery: poolMetrics.lastSuccessfulQuery ?? null,
        poolStatus: poolMetrics.status,
        totalConnections: poolMetrics.totalConnections,
        freeConnections: poolMetrics.freeConnections,
        queuedRequests: poolMetrics.queuedRequests,
        staleRetries: poolMetrics.counters?.staleRetries ?? 0,
        queriesExecuted: poolMetrics.counters?.queriesExecuted ?? 0,
        queriesFailed: poolMetrics.counters?.queriesFailed ?? 0,
      },
    });
  });

  // Admin-only forensic diagnostic benchmark endpoint
  app.get("/api/forensic-db-probe", async (req, res) => {
    // In production, reject unless authenticated as admin
    if (process.env.NODE_ENV === "production") {
      try {
        const user = await (await import("./sdk")).sdk.authenticateRequest(req);
        if (!user || user.role !== "admin") {
          return res.status(403).json({ error: "Access denied. Admin authorization required." });
        }
      } catch {
        return res.status(403).json({ error: "Access denied. Authentication required." });
      }
    }

    try {
      const benchmark = await runDatabaseForensicBenchmark();
      res.status(200).json(benchmark);
    } catch (err: any) {
      res.status(500).json({
        error: "Forensic benchmark failed",
        message: err?.message || String(err),
      });
    }
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
    // Verify Web Push VAPID credentials for background delivery
    import("../push").then(p => p.verifyVapidConfiguration()).catch(console.warn);
    // Start automated emergency dispatch background orchestrator
    import("../dispatch/dispatch").then(d => d.startDispatchWorker()).catch(console.warn);
  });
}

startServer().catch(console.error);
