import { Router, type Request, type Response } from 'express';
import { pool } from '../db/index.js';
import { zoneGuard, supervisorOnly } from '../middleware/auth.js';
import {
  acknowledgeAlert,
  resolveAlert,
  getOpenAlertsForSensor,
} from '../services/alerts.js';

const router = Router();

/**
 * GET /api/alerts
 *
 * Fetch all open/recent alerts in user's zones
 *
 * For operators: Returns only alerts for sensors in their assigned zones
 * For supervisors: Returns all alerts (no filter)
 *
 * @query {string} status - Filter by status (open|acknowledged|resolved), default 'open'
 * @query {number} limit - Max results, default 50
 * @returns {Array} Array of alerts with sensor + rule information
 */
router.get('/api/alerts', zoneGuard, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = req.query.status || 'open';
    const limit = Math.min(Number(req.query.limit) || 50, 500);

    const userZones =
      req.user.role === 'supervisor' ? [] : req.user.zones;

    let query = `
      SELECT 
        a.id,
        a.anomaly_id,
        a.sensor_id,
        s.name as sensor_name,
        s.zone_id,
        z.name as zone_name,
        a.severity,
        a.status,
        a.assigned_to,
        u.email as assigned_to_email,
        a.escalated,
        a.suppressed,
        a.created_at,
        an.rule_type,
        sr.config as rule_config
      FROM alerts a
      JOIN sensors s ON s.id = a.sensor_id
      JOIN zones z ON z.id = s.zone_id
      JOIN anomalies an ON an.id = a.anomaly_id
      LEFT JOIN sensor_rules sr ON sr.id = an.rule_id
      LEFT JOIN users u ON u.id = a.assigned_to
      WHERE a.status = $1
    `;

    const params: unknown[] = [status];

    // Data layer isolation: operator zone scoping
    if (userZones.length > 0) {
      query += ` AND z.id = ANY($2)`;
      params.push(userZones);
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('[GET /api/alerts] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/alerts/:id
 *
 * Fetch a single alert with full details
 */
router.get('/api/alerts/:id', zoneGuard, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const alertId = req.params.id;
    const userZones =
      req.user.role === 'supervisor' ? [] : req.user.zones;

    let query = `
      SELECT 
        a.id,
        a.anomaly_id,
        a.sensor_id,
        s.name as sensor_name,
        s.zone_id,
        z.name as zone_name,
        a.severity,
        a.status,
        a.assigned_to,
        u.email as assigned_to_email,
        a.escalated,
        a.suppressed,
        a.created_at,
        an.rule_type,
        an.detected_at,
        sr.config as rule_config,
        (SELECT COUNT(*) FROM alert_audit_log WHERE alert_id = a.id) as audit_count
      FROM alerts a
      JOIN sensors s ON s.id = a.sensor_id
      JOIN zones z ON z.id = s.zone_id
      JOIN anomalies an ON an.id = a.anomaly_id
      LEFT JOIN sensor_rules sr ON sr.id = an.rule_id
      LEFT JOIN users u ON u.id = a.assigned_to
      WHERE a.id = $1
    `;

    const params: unknown[] = [alertId];

    // Data layer isolation
    if (userZones.length > 0) {
      query += ` AND z.id = ANY($2)`;
      params.push(userZones);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const alert = result.rows[0];

    // Fetch audit log
    const auditResult = await pool.query(
      `SELECT from_status, to_status, changed_by, changed_at
       FROM alert_audit_log
       WHERE alert_id = $1
       ORDER BY changed_at ASC`,
      [alertId]
    );

    res.json({
      ...alert,
      audit_log: auditResult.rows,
    });
  } catch (error) {
    console.error('[GET /api/alerts/:id] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/alerts/:id/acknowledge
 *
 * Mark an alert as acknowledged
 */
router.patch(
  '/api/alerts/:id/acknowledge',
  zoneGuard,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const alertId = req.params.id;
      // req.user is guaranteed to exist and have an id string from auth middleware
      // @ts-ignore - Express types conflict
      await acknowledgeAlert(alertId, req.user!.id);

      res.json({ status: 'acknowledged' });
    } catch (error) {
      console.error('[PATCH /api/alerts/:id/acknowledge] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/alerts/:id/resolve
 *
 * Resolve an alert
 */
router.patch(
  '/api/alerts/:id/resolve',
  zoneGuard,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const alertId = req.params.id;
      // req.user is guaranteed to exist and have an id string from auth middleware
      // @ts-ignore - Express types conflict
      await resolveAlert(alertId, req.user!.id);

      res.json({ status: 'resolved' });
    } catch (error) {
      console.error('[PATCH /api/alerts/:id/resolve] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/anomalies
 *
 * Fetch anomalies (mostly debugging/analytics)
 */
router.get('/api/anomalies', supervisorOnly, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 1000);

    const result = await pool.query(
      `SELECT 
        id,
        reading_id,
        sensor_id,
        rule_id,
        rule_type,
        detected_at,
        suppressed
      FROM anomalies
      ORDER BY detected_at DESC
      LIMIT $1`,
      [limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[GET /api/anomalies] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
