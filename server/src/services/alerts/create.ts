import { pool } from "../../db/index.js";
import { emitAlertEvent } from "../../realtime/emitter.js";
import type { Alert } from "./types.js";

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
  severity: "warning" | "critical",
): Promise<Alert | null> {
  try {
    // Check if anomaly is suppressed
    const anomalyResult = await pool.query(
      "SELECT suppressed FROM anomalies WHERE id = $1",
      [anomalyId],
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
      "SELECT zone_id FROM sensors WHERE id = $1",
      [sensorId],
    );

    if (sensorResult.rows.length === 0) {
      console.warn(`Sensor ${sensorId} not found`);
      return null;
    }

    const zoneId = sensorResult.rows[0].zone_id;

    // Check if alert already exists for this anomaly
    const existingAlert = await pool.query(
      "SELECT id FROM alerts WHERE anomaly_id = $1",
      [anomalyId],
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
      [zoneId],
    );

    const assignedTo =
      operatorResult.rows.length > 0 ? operatorResult.rows[0].id : null;

    // Create alert
    const alertResult = await pool.query(
      `INSERT INTO alerts (anomaly_id, sensor_id, assigned_to, severity, status, suppressed, escalated)
       VALUES ($1, $2, $3, $4, 'open', false, false)
       RETURNING id, anomaly_id, sensor_id, assigned_to, severity, status, suppressed, escalated, created_at`,
      [anomalyId, sensorId, assignedTo, severity],
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
      [alert.id],
    );

    // Get sensor name for real-time event
    const sensorNameResult = await pool.query(
      "SELECT name FROM sensors WHERE id = $1",
      [sensorId],
    );
    const sensorName = sensorNameResult.rows[0]?.name || `Sensor ${sensorId}`;

    // Emit real-time event (Phase 5)
    emitAlertEvent({
      alert_id: alert.id,
      sensor_id: sensorId,
      zone_id: sensorResult.rows[0].zone_id,
      type: "created",
      severity: alert.severity,
      sensor_name: sensorName,
      assigned_to: alert.assigned_to,
      status: alert.status,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `🚨 [Alerts] Created alert ${alert.id} (${severity}) for anomaly ${anomalyId}`,
    );

    return alert;
  } catch (error) {
    console.error(`Error creating alert for anomaly ${anomalyId}:`, error);
    throw error;
  }
}
