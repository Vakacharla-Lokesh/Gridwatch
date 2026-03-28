import { pool } from "../../db/index.js";
import type { SuppressionWindow } from "./types.js";

/**
 * Create a new suppression window for a sensor
 *
 * During suppression:
 * - New anomalies ARE recorded (suppressed=true)
 * - New alerts ARE NOT created
 * - No notifications are sent
 * - Existing open alerts remain open but are marked suppressed=true
 *
 * @param sensorId - UUID of the sensor
 * @param createdBy - UUID of the user creating the suppression
 * @param startTime - ISO timestamp
 * @param endTime - ISO timestamp
 * @param reason - Optional reason for suppression
 */
export async function createSuppression(
  sensorId: string,
  createdBy: string,
  startTime: string,
  endTime: string,
  reason?: string,
): Promise<SuppressionWindow> {
  try {
    const result = await pool.query(
      `INSERT INTO suppressions (sensor_id, created_by, start_time, end_time, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, sensor_id, created_by, start_time, end_time, reason`,
      [sensorId, createdBy, startTime, endTime, reason || null],
    );

    if (result.rows.length === 0) {
      throw new Error("Failed to create suppression");
    }

    console.log(
      `📍 [Suppression] Created for sensor ${sensorId} until ${endTime}`,
    );

    return result.rows[0];
  } catch (error) {
    console.error(`Error creating suppression:`, error);
    throw error;
  }
}

/**
 * Delete a suppression window by ID
 *
 * Can only delete suppressions that haven't started yet or are for future windows.
 * Active suppressions can be deleted to prematurely end suppression.
 *
 * @param suppressionId - UUID of suppression to delete
 * @returns true if deletion succeeded, false if suppression not found
 */
export async function deleteSuppression(
  suppressionId: string,
): Promise<boolean> {
  try {
    const result = await pool.query(`DELETE FROM suppressions WHERE id = $1`, [
      suppressionId,
    ]);

    if (result.rowCount === 0) {
      console.warn(`Suppression ${suppressionId} not found for deletion`);
      return false;
    }

    console.log(`📍 [Suppression] Deleted ${suppressionId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting suppression ${suppressionId}:`, error);
    throw error;
  }
}
