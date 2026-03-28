import { pool } from "../db/index.js";
import { createAlert } from "../services/alerts.js";
import { updateSensorState } from "../services/sensor.js";

/**
 * Pattern Absence Worker
 *
 * Runs independently every 30 seconds.
 * Detects sensors that haven't sent readings for > 2 minutes.
 * Creates a pattern_absence anomaly + alert.
 *
 * Runs separately from the anomaly queue to catch silences continuously.
 */

interface SilentSensor {
  sensor_id: string;
  rule_id: string;
  rule_type: string;
  config: Record<string, unknown>;
  severity: "warning" | "critical";
}

/**
 * Check for sensors in pattern absence (no readings for 2+ minutes)
 * Called periodically by interval timer
 */
export async function checkPatternAbsence(): Promise<void> {
  try {
    // Find sensors with pattern_absence rules that are currently silent
    const silentsResult = await pool.query(
      `SELECT s.id as sensor_id, sr.id as rule_id, sr.rule_type, sr.config, sr.severity
       FROM sensors s
       JOIN sensor_rules sr ON sr.sensor_id = s.id AND sr.rule_type = 'pattern_absence'
       WHERE (s.last_reading_at IS NULL OR s.last_reading_at < NOW() - INTERVAL '2 minutes')
       ORDER BY s.id`,
    );

    const silentSensors = silentsResult.rows as SilentSensor[];

    if (silentSensors.length === 0) return;

    console.log(
      `🔇 [Pattern Absence] Found ${silentSensors.length} potentially silent sensors, checking...`,
    );

    for (const sensor of silentSensors) {
      // Check if we already have a recent pattern_absence anomaly
      const existingResult = await pool.query(
        `SELECT id FROM anomalies
         WHERE sensor_id = $1 AND rule_type = 'pattern_absence'
           AND detected_at > NOW() - INTERVAL '3 minutes'
         LIMIT 1`,
        [sensor.sensor_id],
      );

      if (existingResult.rows.length > 0) {
        // Already recorded recently, skip
        continue;
      }

      // Create anomaly for pattern absence (no reading_id since this is absence)
      const anomalyResult = await pool.query(
        `INSERT INTO anomalies (reading_id, sensor_id, rule_id, rule_type, detected_at, suppressed)
         VALUES (NULL, $1, $2, 'pattern_absence', NOW(), false)
         RETURNING id`,
        [sensor.sensor_id, sensor.rule_id],
      );

      const anomalyId = anomalyResult.rows[0].id;

      console.log(
        `⚠️  [Pattern Absence] Sensor ${sensor.sensor_id} silent for 2+ min, anomaly: ${anomalyId}`,
      );

      // Create alert for pattern absence
      const alert = await createAlert(
        anomalyId,
        sensor.sensor_id,
        sensor.severity,
      );

      // Update sensor state to 'silent'
      if (alert) {
        await updateSensorState(sensor.sensor_id, "silent");
      }
    }

    console.log(`✅ [Pattern Absence] Pattern absence check completed`);
  } catch (error) {
    console.error("[Pattern Absence Worker] Error:", error);
    // Don't throw — this worker runs on a timer and should recover
  }
}

/**
 * Start the pattern absence worker timer
 * Runs every 30 seconds
 */
export function startPatternAbsenceWorker(): NodeJS.Timer {
  console.log(`🚀 [Pattern Absence] Starting worker (checks every 30s)...`);

  // Run immediately first
  checkPatternAbsence().catch((err) =>
    console.error("[Pattern Absence] Initial check failed:", err),
  );

  // Then run every 30 seconds
  const timer = setInterval(() => {
    checkPatternAbsence().catch((err) =>
      console.error("[Pattern Absence] Periodic check failed:", err),
    );
  }, 30_000); // 30 seconds

  return timer;
}
