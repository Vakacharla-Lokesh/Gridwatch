import { Router, type Request, type Response } from "express";
import { pool } from "../db/index.js";
import { zoneGuard } from "../middleware/auth.js";
import {
  createSuppression,
  getActiveSuppressionsForSensor,
  getSuppressionHistory,
  deleteSuppression,
} from "../services/suppression.js";
import { emitSuppressionEvent } from "../realtime/emitter.js";

const router = Router();

/**
 * POST /api/suppressions
 *
 * Create a new suppression window for a sensor
 *
 * Request body:
 * {
 *   sensor_id: UUID,
 *   start_time: ISO timestamp,
 *   end_time: ISO timestamp,
 *   reason?: string
 * }
 *
 * During suppression:
 * - New anomalies ARE recorded (suppressed=true)
 * - New alerts ARE NOT created
 * - No notifications are sent
 * - Existing open alerts remain open but can be marked suppressed=true
 */
router.post(
  "/api/suppressions",
  zoneGuard,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { sensor_id, start_time, end_time, reason } = req.body;

      // Ensure reason is empty string if null/undefined
      const finalReason = reason || "";

      // Validate required fields
      if (!sensor_id || !start_time || !end_time) {
        return res.status(400).json({
          error: "Missing required fields: sensor_id, start_time, end_time",
        });
      }

      // Validate end_time > start_time
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);
      if (endDate <= startDate) {
        return res.status(400).json({
          error: "end_time must be after start_time",
        });
      }

      // Verify sensor exists and user has access to it
      const sensorCheckQuery = `
      SELECT s.id, s.zone_id, s.name
      FROM sensors s
      WHERE s.id = $1
    `;

      const sensorParams: unknown[] = [sensor_id];

      // Enforce zone scoping for operators
      if (req.user.role !== "supervisor" && req.user.zones.length > 0) {
        // Modify query to check zone access
        const sensorResult = await pool.query(
          `${sensorCheckQuery} AND s.zone_id = ANY($2)`,
          [sensor_id, req.user.zones],
        );

        if (sensorResult.rows.length === 0) {
          return res.status(404).json({
            error: "Sensor not found or you do not have access",
          });
        }
      } else {
        const sensorResult = await pool.query(sensorCheckQuery, sensorParams);
        if (sensorResult.rows.length === 0) {
          return res.status(404).json({ error: "Sensor not found" });
        }
      }

      // Create suppression
      const suppression = await createSuppression(
        sensor_id,
        req.user.id,
        start_time,
        end_time,
        finalReason,
      );

      // Fetch sensor details for real-time event
      const sensorDetailed = await pool.query(
        `SELECT id, zone_id, name FROM sensors WHERE id = $1`,
        [sensor_id],
      );

      if (sensorDetailed.rows.length > 0) {
        const sensor = sensorDetailed.rows[0];
        // Emit suppression event for real-time updates
        emitSuppressionEvent({
          suppression_id: suppression.id,
          sensor_id: sensor.id,
          zone_id: sensor.zone_id,
          sensor_name: sensor.name,
          start_time: suppression.start_time,
          end_time: suppression.end_time,
          reason: suppression.reason || "",
        });
      }

      res.status(201).json(suppression);
    } catch (error) {
      console.error("[POST /api/suppressions] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * GET /api/sensors/:sensorId/suppressions
 *
 * Fetch all suppressions (active and expired) for a sensor
 *
 * @param {string} sensorId - Sensor ID
 * @query {boolean} active_only - If true, return only active suppressions (default false)
 */
router.get(
  "/api/sensors/:sensorId/suppressions",
  zoneGuard,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const sensorId = (req.params.sensorId || "") as string;
      const activeOnly = req.query.active_only === "true";
      const userZones = req.user.zones;

      if (!sensorId) {
        return res.status(400).json({ error: "Invalid sensor ID" });
      }

      // Verify sensor exists and user has access
      let sensorQuery = `SELECT id, zone_id FROM sensors WHERE id = $1`;
      const sensorParams: unknown[] = [sensorId];

      if (req.user.role !== "supervisor" && userZones.length > 0) {
        sensorQuery += ` AND zone_id = ANY($2)`;
        sensorParams.push(userZones);
      }

      const sensorResult = await pool.query(sensorQuery, sensorParams);
      if (sensorResult.rows.length === 0) {
        return res.status(404).json({
          error: "Sensor not found or you do not have access",
        });
      }

      // Fetch suppressions
      const suppressions = activeOnly
        ? await getActiveSuppressionsForSensor(sensorId)
        : await getSuppressionHistory(sensorId);

      res.json(suppressions);
    } catch (error) {
      console.error("[GET /api/sensors/:sensorId/suppressions] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * DELETE /api/suppressions/:suppressionId
 *
 * Cancel/delete a suppression window
 * Allows premature ending of a suppression or removal of future suppressions
 *
 * @param {string} suppressionId - Suppression ID
 */
router.delete(
  "/api/suppressions/:suppressionId",
  zoneGuard,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const suppressionId = (req.params.suppressionId || "") as string;

      if (!suppressionId) {
        return res.status(400).json({ error: "Invalid suppression ID" });
      }

      // Verify suppression exists and user has access to the sensor
      const suppressionQuery = `
        SELECT supp.id, supp.start_time, supp.end_time, s.id as sensor_id, s.zone_id
        FROM suppressions supp
        JOIN sensors s ON s.id = supp.sensor_id
        WHERE supp.id = $1
      `;

      const suppressionParams: unknown[] = [suppressionId];
      let query = suppressionQuery;

      if (req.user.role !== "supervisor" && req.user.zones.length > 0) {
        query += ` AND s.zone_id = ANY($2)`;
        suppressionParams.push(req.user.zones);
      }

      const suppressionResult = await pool.query(query, suppressionParams);
      if (suppressionResult.rows.length === 0) {
        return res.status(404).json({
          error: "Suppression not found or you do not have access",
        });
      }

      const suppression = suppressionResult.rows[0];

      // Delete suppression
      const deleted = await deleteSuppression(suppressionId);

      if (!deleted) {
        return res.status(404).json({ error: "Suppression not found" });
      }

      // Emit suppression deletion event using data we already have from the query
      const sensorResult = await pool.query(
        `SELECT id, name FROM sensors WHERE id = $1`,
        [suppression.sensor_id],
      );

      if (sensorResult.rows.length > 0) {
        const sensor = sensorResult.rows[0];
        emitSuppressionEvent({
          suppression_id: suppressionId,
          sensor_id: suppression.sensor_id,
          zone_id: suppression.zone_id,
          sensor_name: sensor.name,
          start_time: suppression.start_time,
          end_time: suppression.end_time,
          reason: "",
        });
      }

      res.status(204).send();
    } catch (error) {
      console.error("[DELETE /api/suppressions/:suppressionId] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
