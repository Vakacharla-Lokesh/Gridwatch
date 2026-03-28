import { Router, type Request, type Response } from "express";
import { getEnv } from "../config/env";

const router = Router();
const { port } = getEnv();

/**
 * POST /api/testing/run-ingest
 *
 * Run the test-ingest script to send test sensor readings
 */
router.post("/api/testing/run-ingest", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(
      `🧪 [Testing] Running test-ingest (triggered by ${req.user.id})`,
    );

    // Use Bun's built-in subprocess API
    const subprocess = (globalThis as any).Bun.spawn(
      ["bun", "run", "scripts/test-ingest.ts"],
      {
        env: {
          ...process.env,
          API_URL: `http://localhost:${port}`,
        },
      },
    );

    const output = await new Response(subprocess.stdout).text();

    res.json({
      success: true,
      message: "Test ingest script executed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error running test-ingest:", error);
    res.status(500).json({
      success: false,
      error: "Failed to run test script",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/testing/run-anomalies
 *
 * Run the test-anomalies script to test anomaly detection
 */
router.post(
  "/api/testing/run-anomalies",
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log(
        `🧪 [Testing] Running test-anomalies (triggered by ${req.user.id})`,
      );

      // Use Bun's built-in subprocess API
      const subprocess = (globalThis as any).Bun.spawn(
        ["bun", "run", "scripts/test-anomalies.ts"],
        {
          env: {
            ...process.env,
            API_URL: `http://localhost:${port}`,
          },
        },
      );

      const output = await new Response(subprocess.stdout).text();

      res.json({
        success: true,
        message: "Test anomalies script executed successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error running test-anomalies:", error);
      res.status(500).json({
        success: false,
        error: "Failed to run test script",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export default router;
