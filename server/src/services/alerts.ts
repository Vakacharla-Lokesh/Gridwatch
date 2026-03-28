import { pool } from '../db/index.js';

/**
 * Alert service
 *
 * Handles alert lifecycle:
 * - Create alerts from anomalies (unless suppressed)
 * - Assign to zone operators
 * - Track audit log
 */

export interface Alert {
  id: string;
  anomaly_id: string;
  sensor_id: string;
  assigned_to: string | null;
  severity: 'warning' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  suppressed: boolean;
  escalated: boolean;
  created_at: string;
}

/**
 * Create an alert from an anomaly
 *
 * Rules:
 * - Do NOT create if anomaly is suppressed
 * - Do NOT create if alert already exists for this reading + rule combo
 * - Auto-assign to an operator in the sensor's zone
 *
 * @param anomalyId - UUID of the anomaly record
 * @param sensorId - UUID of the sensor
 * @param severity - 'warning' | 'critical'
 * @returns Alert record or null if suppressed
 */
export async function createAlert(
  anomalyId: string,
  sensorId: string,
  severity: 'warning' | 'critical'
): Promise<Alert | null> {
  try {
    // Check if anomaly is suppressed
    const anomalyResult = await pool.query(
      'SELECT suppressed FROM anomalies WHERE id = $1',
      [anomalyId]
    );

    if (anomalyResult.rows.length === 0) {
      console.warn(`Anomaly ${anomalyId} not found`);
      return null;
    }

    if (anomalyResult.rows[0].suppressed) {
      console.log(`🔇 [Alerts] Anomaly suppressed, skipping alert creation`);
      return null;
    }

    // Get sensor's zone
    const sensorResult = await pool.query(
      'SELECT zone_id FROM sensors WHERE id = $1',
      [sensorId]
    );

    if (sensorResult.rows.length === 0) {
      console.warn(`Sensor ${sensorId} not found`);
      return null;
    }

    const zoneId = sensorResult.rows[0].zone_id;

    // Check if alert already exists for this anomaly
    const existingAlert = await pool.query(
      'SELECT id FROM alerts WHERE anomaly_id = $1',
      [anomalyId]
    );

    if (existingAlert.rows.length > 0) {
      console.log(`⚠️  [Alerts] Alert already exists for anomaly ${anomalyId}`);
      return existingAlert.rows[0];
    }

    // Find an available operator in this zone to assign to
    const operatorResult = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_zones uz ON uz.user_id = u.id
       WHERE u.role = 'operator' AND uz.zone_id = $1
       LIMIT 1`,
      [zoneId]
    );

    const assignedTo = operatorResult.rows.length > 0 ? operatorResult.rows[0].id : null;

    // Create alert
    const alertResult = await pool.query(
      `INSERT INTO alerts (anomaly_id, sensor_id, assigned_to, severity, status, suppressed, escalated)
       VALUES ($1, $2, $3, $4, 'open', false, false)
       RETURNING id, anomaly_id, sensor_id, assigned_to, severity, status, suppressed, escalated, created_at`,
      [anomalyId, sensorId, assignedTo, severity]
    );

    if (alertResult.rows.length === 0) {
      console.warn(`Failed to create alert for anomaly ${anomalyId}`);
      return null;
    }

    const alert = alertResult.rows[0];

    // Log this alert creation in audit log
    await pool.query(
      `INSERT INTO alert_audit_log (alert_id, from_status, to_status)
       VALUES ($1, NULL, 'open')`,
      [alert.id]
    );

    console.log(
      `🚨 [Alerts] Created alert ${alert.id} (${severity}) for anomaly ${anomalyId}`
    );

    return alert;
  } catch (error) {
    console.error(`Error creating alert for anomaly ${anomalyId}:`, error);
    throw error;
  }
}

/**
 * Get all open alerts for a sensor
 */
export async function getOpenAlertsForSensor(sensorId: string): Promise<Alert[]> {
  try {
    const result = await pool.query(
      `SELECT id, anomaly_id, sensor_id, assigned_to, severity, status, suppressed, escalated, created_at
       FROM alerts
       WHERE sensor_id = $1 AND status = 'open'
       ORDER BY created_at DESC`,
      [sensorId]
    );

    return result.rows;
  } catch (error) {
    console.error(`Error fetching open alerts for sensor ${sensorId}:`, error);
    throw error;
  }
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: any
): Promise<void> {

  try {
    await pool.query(
      `UPDATE alerts SET status = 'acknowledged' WHERE id = $1 AND status = 'open'`,
      [alertId]
    );

    // Log in audit
    await pool.query(
      `INSERT INTO alert_audit_log (alert_id, changed_by, from_status, to_status)
       VALUES ($1, $2, 'open', 'acknowledged')`,
      [alertId, userId]
    );

    console.log(`✅ [Alerts] Alert ${alertId} acknowledged`);
  } catch (error) {
    console.error(`Error acknowledging alert ${alertId}:`, error);
    throw error;
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(
  alertId: string,
  userId: any
): Promise<void> {

  try {
    const result = await pool.query(
      `UPDATE alerts SET status = 'resolved' WHERE id = $1
       RETURNING status`,
      [alertId]
    );

    const previousStatus = result.rows.length > 0 ? result.rows[0].status : 'unknown';

    // Log in audit
    await pool.query(
      `INSERT INTO alert_audit_log (alert_id, changed_by, from_status, to_status)
       VALUES ($1, $2, $3, 'resolved')`,
      [alertId, userId, previousStatus]
    );

    console.log(`✅ [Alerts] Alert ${alertId} resolved`);
  } catch (error) {
    console.error(`Error resolving alert ${alertId}:`, error);
    throw error;
  }
}
