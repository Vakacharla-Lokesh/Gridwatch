import { pool } from "../../db/index.js";
import type { Alert } from "./types.js";

/**
 * Get all open alerts for a sensor
 */
export async function getOpenAlertsForSensor(
  sensorId: string,
): Promise<Alert[]> {
  try {
    const result = await pool.query(
      `SELECT id, anomaly_id, sensor_id, assigned_to, severity, status, suppressed, escalated, created_at
       FROM alerts
       WHERE sensor_id = $1 AND status = 'open'
       ORDER BY created_at DESC`,
      [sensorId],
    );

    return result.rows;
  } catch (error) {
    console.error(`Error fetching open alerts for sensor ${sensorId}:`, error);
    throw error;
  }
}
