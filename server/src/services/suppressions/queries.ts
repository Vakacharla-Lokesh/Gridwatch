import { pool } from "../../db/index.js";
import type { SuppressionWindow } from "./types.js";

/**
 * Check if a sensor is currently under suppression
 *
 * @param sensorId - UUID of the sensor
 * @returns true if an active suppression window exists, false otherwise
 */
export async function isCurrentlySuppressed(
  sensorId: string,
): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM suppressions
       WHERE sensor_id = $1
       AND start_time <= NOW()
       AND end_time >= NOW()
       LIMIT 1`,
      [sensorId],
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error(`Error checking suppression for sensor ${sensorId}:`, error);
    throw error;
  }
}

/**
 * Get all active suppressions for a sensor
 */
export async function getActiveSuppressionsForSensor(
  sensorId: string,
): Promise<SuppressionWindow[]> {
  try {
    const result = await pool.query(
      `SELECT id, sensor_id, created_by, start_time, end_time, reason
       FROM suppressions
       WHERE sensor_id = $1
       AND start_time <= NOW()
       AND end_time >= NOW()
       ORDER BY start_time DESC`,
      [sensorId],
    );

    return result.rows;
  } catch (error) {
    console.error(
      `Error fetching active suppressions for sensor ${sensorId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Get all suppressions for a sensor (active and expired)
 */
export async function getSuppressionHistory(
  sensorId: string,
): Promise<SuppressionWindow[]> {
  try {
    const result = await pool.query(
      `SELECT id, sensor_id, created_by, start_time, end_time, reason
       FROM suppressions
       WHERE sensor_id = $1
       ORDER BY start_time DESC`,
      [sensorId],
    );

    return result.rows;
  } catch (error) {
    console.error(
      `Error fetching suppression history for sensor ${sensorId}:`,
      error,
    );
    throw error;
  }
}
