import { Router, type Request, type Response } from "express";
import { pool } from "../db/index.js";
import { zoneGuard } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/sensors
 *
 * Fetch all sensors in user's accessible zones
 *
 * For operators: Returns only sensors in their assigned zones
 * For supervisors: Returns all sensors (no filter)
 *
 * @query {string} zone_id - Optional zone filter (enforced at middleware)
 * @returns {Array} Array of sensors with current state and last reading time
 */
router.get("/api/sensors", zoneGuard, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Build zone filter
    // Supervisors have empty zones array or can access all zones
    // Operators have specific zone IDs
    const zones =
      req.user.role === "supervisor"
        ? [] // Empty for supervisors (no WHERE filter needed)
        : req.user.zones; // Operator zones

    let query = `
      SELECT 
        id,
        zone_id,
        name,
        current_state,
        last_reading_at,
        (SELECT COUNT(*) FROM readings WHERE sensor_id = sensors.id) as reading_count,
        (SELECT COUNT(*) FROM alerts 
         WHERE sensor_id = sensors.id AND status = 'open') as open_alerts
      FROM sensors
    `;

    const params: unknown[] = [];

    // Data layer isolation: enforce zone filtering
    if (zones.length > 0) {
      query += " WHERE zone_id = ANY($1)";
      params.push(zones);
    }

    query += " ORDER BY current_state DESC, last_reading_at DESC";

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error("[GET /api/sensors] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/sensors/:id
 *
 * Fetch a single sensor with detailed information
 *
 * @param {string} id - Sensor ID
 * @returns {Object} Sensor details including active rules
 */
router.get(
  "/api/sensors/:id",
  zoneGuard,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const sensorId = req.params.id;
      const userZones = req.user.zones;

      // Fetch sensor with zone scoping
      let query = `
      SELECT 
        s.id,
        s.zone_id,
        s.name,
        s.current_state,
        s.last_reading_at,
        z.name as zone_name,
        (SELECT COUNT(*) FROM readings WHERE sensor_id = s.id) as total_readings,
        (SELECT COUNT(*) FROM readings WHERE sensor_id = s.id AND has_anomaly = true) as anomaly_count,
        (SELECT COUNT(*) FROM alerts WHERE sensor_id = s.id AND status = 'open') as open_alerts
      FROM sensors s
      LEFT JOIN zones z ON z.id = s.zone_id
      WHERE s.id = $1
    `;

      const params: unknown[] = [sensorId];

      // Data layer isolation: enforce zone filtering
      if (req.user.role !== "supervisor" && userZones.length > 0) {
        query += " AND s.zone_id = ANY($2)";
        params.push(userZones);
      }

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Sensor not found" });
      }

      const sensor = result.rows[0];

      // Fetch sensor rules
      const rulesResult = await pool.query(
        "SELECT id, rule_type, config, severity FROM sensor_rules WHERE sensor_id = $1",
        [sensorId],
      );

      res.json({
        ...sensor,
        rules: rulesResult.rows,
      });
    } catch (error) {
      console.error("[GET /api/sensors/:id] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
