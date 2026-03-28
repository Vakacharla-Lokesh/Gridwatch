import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { authMiddleware } from "./src/middleware/auth.js";
import { shutdown } from "./src/db/index.js";
import { startPatternAbsenceWorker } from "./src/workers/patternAbsence.js";
import { startEscalationWorker } from "./src/workers/escalation.js";
import { initializeIO, getConnectionStats } from "./src/realtime/io.js";
import { getRedisStatus } from "./src/lib/redis.js";
import { getEnv, logStartupConfig } from "./src/config/env.js";
import healthRoutes from "./src/routes/health.js";
import authRoutes from "./src/routes/auth.js";
import ingestRoutes from "./src/routes/ingest.js";
import sensorRoutes from "./src/routes/sensors.js";
import alertRoutes from "./src/routes/alerts.js";
import suppressionRoutes from "./src/routes/suppressions.js";
import testingRoutes from "./src/routes/testing.js";

const app: Express = express();
const { port, corsOrigin } = getEnv();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Error handling middleware for async route handlers
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Health check (no auth required)
app.use(healthRoutes);

// Auth routes (login/logout - no auth required)
app.use(authRoutes);

// Ingest pipeline (no zone auth required for simplicity, but in production add zone validation)
app.use(ingestRoutes);

// Auth middleware (protect all other routes)
app.use(authMiddleware);

// Sensor routes
app.use(sensorRoutes);

// Alert routes (Phase 3+)
app.use(alertRoutes);

// Suppression routes (Phase 6)
app.use(suppressionRoutes);

// Testing routes (for running test scripts)
app.use(testingRoutes);

// Debug: Socket.IO connection stats + Redis status (Phase 5 + Phase 9)
app.get("/api/debug/connections", (req, res) => {
  const stats = getConnectionStats();
  const redisStatus = getRedisStatus();
  res.json({ socketIO: stats, redis: redisStatus });
});

// Routes
app.get("/api/sensors", (req, res) => {
  res.json({ message: "Sensors endpoint - Phase 2" });
});

app.get("/api/alerts", (req, res) => {
  res.json({ message: "Alerts endpoint - Phase 4" });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

// Log startup configuration
logStartupConfig();

// Start server
const server = app.listen(port, async () => {
  console.log(`✅ Server running at http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);

  // Initialize Socket.IO (Phase 5)
  initializeIO(server);

  // Start background workers
  startPatternAbsenceWorker();
  startEscalationWorker();
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(async () => {
    await shutdown();
    process.exit(0);
  });
});
