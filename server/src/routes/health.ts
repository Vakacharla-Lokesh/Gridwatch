import { Router } from "express";
import { pool } from "../db/index.js";

const router = Router();

router.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      status: "ok",
      timestamp: result.rows[0].now,
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res
      .status(503)
      .json({ status: "error", error: "Database connection failed" });
  }
});

export default router;
