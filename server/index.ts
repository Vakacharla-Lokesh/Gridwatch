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
import healthRoutes from "./src/routes/health.js";

const app: Express = express();
const port = process.env.PORT || 3001;

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

// Auth middleware (protect all other routes)
app.use(authMiddleware);

// Routes
app.get("/api/sensors", (req, res) => {
  res.json({ message: "Sensors endpoint - Phase 2" });
});

app.post("/api/ingest", (req, res) => {
  res.json({ message: "Ingest endpoint - Phase 2" });
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

// Start server
const server = app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(async () => {
    await shutdown();
    process.exit(0);
  });
});
