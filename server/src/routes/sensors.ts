import { Router, type Request, type Response } from "express";
import { pool } from "../db/index.js";
import { zoneGuard } from "../middleware/auth.js";
import { cacheGet, cacheSet } from "../lib/redis.js";

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

    const cacheKey = `sensors:${req.user.role}:${(req.user.zones || []).sort().join(",")}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const zones =
      req.user.role === "supervisor"
        ? []
        : req.user.zones;

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

    if (zones.length > 0) {
      query += " WHERE zone_id = ANY($1)";
      params.push(zones);
    }

    query += " ORDER BY current_state DESC, last_reading_at DESC";

    const result = await pool.query(query, params);

    await cacheSet(cacheKey, result.rows, 300);

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

/**
 * GET /api/sensors/:id/history
 *
 * Fetch historical readings for a sensor with anomaly and alert details
 *
 * @param {string} id - Sensor ID
 * @query {string} from - Start timestamp (ISO 8601), default 24 hours ago
 * @query {string} to - End timestamp (ISO 8601), default now
 * @query {number} page - Page number (default 1)
 * @query {number} limit - Results per page (max 500, default 100)
 *
 * Returns paginated readings with anomaly/alert details
 */
router.get(
  "/api/sensors/:id/history",
  zoneGuard,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const sensorId = req.params.id;
      const userZones = req.user.zones;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const offset = (page - 1) * limit;

      let from = req.query.from as string | undefined;
      let to = req.query.to as string | undefined;

      if (!from) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        from = twentyFourHoursAgo.toISOString();
      }

      if (!to) {
        to = new Date().toISOString();
      }

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

      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM readings
         WHERE sensor_id = $1 AND timestamp BETWEEN $2 AND $3`,
        [sensorId, from, to],
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const historyQuery = `
        SELECT
          r.id,
          r.sensor_id,
          r.timestamp,
          r.voltage,
          r.current,
          r.temperature,
          r.status_code,
          r.has_anomaly,
          CASE
            WHEN r.has_anomaly THEN (
              SELECT json_agg(
                json_build_object(
                  'anomaly_id', a.id,
                  'rule_type', a.rule_type,
                  'detected_at', a.detected_at,
                  'suppressed', a.suppressed,
                  'alert_id', al.id,
                  'alert_status', al.status,
                  'alert_severity', al.severity
                )
              )
              FROM anomalies a
              LEFT JOIN alerts al ON al.anomaly_id = a.id
              WHERE a.reading_id = r.id
            )
            ELSE NULL
          END as anomaly_details
        FROM readings r
        WHERE r.sensor_id = $1
          AND r.timestamp BETWEEN $2 AND $3
        ORDER BY r.timestamp DESC
        LIMIT $4 OFFSET $5
      `;

      const result = await pool.query(historyQuery, [
        sensorId,
        from,
        to,
        limit,
        offset,
      ]);

      res.json({
        data: result.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        timeRange: {
          from,
          to,
        },
      });
    } catch (error) {
      console.error("[GET /api/sensors/:id/history] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
