import { pool } from '../db/index.js';

/**
 * Sensor state management service
 *
 * Handles updating sensor metadata when readings arrive:
 * - Updates last_reading_at timestamp
 * - Updates current_state based on anomalies (managed by workers)
 */

export async function updateSensorLastReading(sensorId: string): Promise<void> {
  try {
    const result = await pool.query(
      `UPDATE sensors 
       SET last_reading_at = (
         SELECT MAX(timestamp) FROM readings WHERE sensor_id = $1
       )
       WHERE id = $1`,
      [sensorId]
    );

    if (result.rowCount === 0) {
      console.warn(`Sensor ${sensorId} not found`);
    }
  } catch (error) {
    console.error(`Error updating sensor ${sensorId}:`, error);
    throw error;
  }
}

/**
 * Update a sensor's current state
 * This is called by anomaly detection workers when:
 * - A threshold breach is detected → 'warning' | 'critical'
 * - All alerts are resolved → 'healthy'
 * - Pattern absence is detected → 'silent'
 */
export async function updateSensorState(
  sensorId: string,
  state: 'healthy' | 'warning' | 'critical' | 'silent'
): Promise<void> {
  try {
    const result = await pool.query(
      'UPDATE sensors SET current_state = $1 WHERE id = $2',
      [state, sensorId]
    );

    if (result.rowCount === 0) {
      console.warn(`Sensor ${sensorId} not found`);
    }
  } catch (error) {
    console.error(`Error updating sensor state for ${sensorId}:`, error);
    throw error;
  }
}

/**
 * Get the highest severity state across all open alerts for a sensor
 * Used to determine if sensor should be in 'warning' vs 'critical'
 */
export async function getHighestAlertSeverity(
  sensorId: string
): Promise<'healthy' | 'warning' | 'critical' | null> {
  try {
    const result = await pool.query(
      `SELECT severity FROM alerts 
       WHERE sensor_id = $1 AND status = 'open'
       ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 END
       LIMIT 1`,
      [sensorId]
    );

    if (result.rows.length === 0) return 'healthy';
    return result.rows[0].severity;
  } catch (error) {
    console.error(
      `Error getting highest alert severity for ${sensorId}:`,
      error
    );
    throw error;
  }
}
