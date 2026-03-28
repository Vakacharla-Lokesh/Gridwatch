import { pool } from "../../db/index.js";
import { emitAlertEvent } from "../../realtime/emitter.js";
import { VALID_TRANSITIONS } from "./types.js";

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: any,
): Promise<void> {
  try {
    // Get current status and alert details
    const currentResult = await pool.query(
      `SELECT status, sensor_id, severity FROM alerts WHERE id = $1`,
      [alertId],
    );

    if (currentResult.rows.length === 0) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const currentStatus = currentResult.rows[0].status;
    const sensorId = currentResult.rows[0].sensor_id;
    const severity = currentResult.rows[0].severity;

    // Validate transition
    if (!VALID_TRANSITIONS[currentStatus]?.includes("acknowledged")) {
      throw new Error(
        `Invalid transition: cannot acknowledge alert with status '${currentStatus}'`,
      );
    }

    await pool.query(
      `UPDATE alerts SET status = 'acknowledged' WHERE id = $1`,
      [alertId],
    );

    // Log in audit
    await pool.query(
      `INSERT INTO alert_audit_log (alert_id, changed_by, from_status, to_status)
       VALUES ($1, $2, $3, 'acknowledged')`,
      [alertId, userId, currentStatus],
    );

    // Get sensor + zone info for real-time event
    const sensorResult = await pool.query(
      "SELECT name, zone_id FROM sensors WHERE id = $1",
      [sensorId],
    );

    if (sensorResult.rows.length > 0) {
      const { name, zone_id } = sensorResult.rows[0];

      // Emit real-time event (Phase 5)
      emitAlertEvent({
        alert_id: alertId,
        sensor_id: sensorId,
        zone_id,
        type: "acknowledged",
        severity,
        sensor_name: name || `Sensor ${sensorId}`,
        assigned_to: userId,
        status: "acknowledged",
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`✅ [Alerts] Alert ${alertId} acknowledged by ${userId}`);
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
  userId: any,
): Promise<void> {
  try {
    // Get current status and alert details
    const currentResult = await pool.query(
      `SELECT status, sensor_id, severity FROM alerts WHERE id = $1`,
      [alertId],
    );

    if (currentResult.rows.length === 0) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const currentStatus = currentResult.rows[0].status;
    const sensorId = currentResult.rows[0].sensor_id;
    const severity = currentResult.rows[0].severity;

    // Validate transition
    if (!VALID_TRANSITIONS[currentStatus]?.includes("resolved")) {
      throw new Error(
        `Invalid transition: cannot resolve alert with status '${currentStatus}'`,
      );
    }

    await pool.query(`UPDATE alerts SET status = 'resolved' WHERE id = $1`, [
      alertId,
    ]);

    // Log in audit
    await pool.query(
      `INSERT INTO alert_audit_log (alert_id, changed_by, from_status, to_status)
       VALUES ($1, $2, $3, 'resolved')`,
      [alertId, userId, currentStatus],
    );

    // Get sensor + zone info for real-time event
    const sensorResult = await pool.query(
      "SELECT name, zone_id FROM sensors WHERE id = $1",
      [sensorId],
    );

    if (sensorResult.rows.length > 0) {
      const { name, zone_id } = sensorResult.rows[0];

      // Emit real-time event (Phase 5)
      emitAlertEvent({
        alert_id: alertId,
        sensor_id: sensorId,
        zone_id,
        type: "resolved",
        severity,
        sensor_name: name || `Sensor ${sensorId}`,
        assigned_to: userId,
        status: "resolved",
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`✅ [Alerts] Alert ${alertId} resolved by ${userId}`);
  } catch (error) {
    console.error(`Error resolving alert ${alertId}:`, error);
    throw error;
  }
}
