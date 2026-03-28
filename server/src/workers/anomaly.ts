import { pool } from '../db/index.js';
import { createAlert } from '../services/alerts.js';
import { updateSensorState } from '../services/sensor.js';
import { isCurrentlySuppressed } from '../services/suppression.js';

/**
 * Anomaly Detection Worker
 *
 * Runs asynchronously when anomalyQueue receives reading IDs.
 * Implements three detection rules:
 * 1. Threshold (value outside min/max bounds)
 * 2. Rate of Change (% change exceeds threshold vs recent average)
 * 3. Pattern Absence (detected by independent cron, not here)
 */

interface SensorRule {
  id: string;
  rule_type: 'threshold' | 'rate_of_change' | 'pattern_absence';
  config: Record<string, unknown>;
  severity: 'warning' | 'critical';
}

interface Reading {
  id: number;
  sensor_id: string;
  voltage: number | null;
  current: number | null;
  temperature: number | null;
}

/**
 * Main entry point called by the anomaly queue listener
 * Fetches readings and rules, runs all detectors
 */
export async function runAnomalyDetectionForReadings(
  readingIds: (number | string)[]
): Promise<void> {
  if (readingIds.length === 0) return;

  try {
    // Fetch the actual readings
    const readingsResult = await pool.query(
      `SELECT id, sensor_id, voltage, current, temperature
       FROM readings
       WHERE id = ANY($1)`,
      [readingIds]
    );

    const readings = readingsResult.rows as Reading[];

    // Group readings by sensor_id
    const readingsBySensor = new Map<string, Reading[]>();
    for (const reading of readings) {
      if (!readingsBySensor.has(reading.sensor_id)) {
        readingsBySensor.set(reading.sensor_id, []);
      }
      readingsBySensor.get(reading.sensor_id)!.push(reading);
    }

    // Process each sensor
    for (const [sensorId, sensorReadings] of readingsBySensor) {
      await processReadingsForSensor(sensorId, sensorReadings);
    }

    console.log(
      `✅ [Anomaly Worker] Completed detection for ${readings.length} readings`
    );
  } catch (error) {
    console.error('[Anomaly Worker] Fatal error:', error);
    throw error;
  }
}

/**
 * Process all readings for a sensor through all applicable rules
 */
async function processReadingsForSensor(
  sensorId: string,
  readings: Reading[]
): Promise<void> {
  try {
    // Fetch all rules for this sensor
    const rulesResult = await pool.query(
      `SELECT id, rule_type, config, severity
       FROM sensor_rules
       WHERE sensor_id = $1`,
      [sensorId]
    );

    const rules = rulesResult.rows as SensorRule[];

    if (rules.length === 0) {
      console.log(`📌 [Anomaly] Sensor ${sensorId} has no rules, skipping`);
      return;
    }

    // Check if sensor is suppressed
    const suppressed = await isCurrentlySuppressed(sensorId);

    // Run detectors on each reading
    for (const reading of readings) {
      await checkThreshold(reading, rules, suppressed);
      await checkRateOfChange(reading, rules, suppressed);
      // Pattern absence is handled by independent cron worker
    }
  } catch (error) {
    console.error(`[Anomaly] Error processing sensor ${sensorId}:`, error);
  }
}

/**
 * Rule A: Threshold Detection
 * Checks if a field value falls outside min/max bounds
 */
async function checkThreshold(
  reading: Reading,
  rules: SensorRule[],
  sensorSuppressed: boolean
): Promise<void> {
  const thresholdRules = rules.filter((r) => r.rule_type === 'threshold');

  for (const rule of thresholdRules) {
    const config = rule.config as {
      field: string;
      min: number;
      max: number;
    };

    const { field, min, max } = config;
    const measurementKey = field as keyof Reading;
    const value = reading[measurementKey] as number | null;

    // Skip if no value for this field
    if (value === null || value === undefined) continue;

    // Check bounds
    if (value < min || value > max) {
      console.log(
        `⚠️  [Anomaly] Threshold breach: ${field}=${value} outside [${min}, ${max}]`
      );

      // Create anomaly
      const anomalyResult = await pool.query(
        `INSERT INTO anomalies (reading_id, sensor_id, rule_id, rule_type, suppressed)
         VALUES ($1, $2, $3, 'threshold', $4)
         RETURNING id`,
        [reading.id, reading.sensor_id, rule.id, sensorSuppressed]
      );

      const anomalyId = anomalyResult.rows[0].id;

      // Mark reading as having anomaly
      await pool.query(
        'UPDATE readings SET has_anomaly = true WHERE id = $1',
        [reading.id]
      );

      // Create alert if not suppressed
      if (!sensorSuppressed) {
        const alert = await createAlert(
          anomalyId,
          reading.sensor_id,
          rule.severity
        );

        // Update sensor state to severity level
        if (alert) {
          await updateSensorState(reading.sensor_id, rule.severity);
        }
      } else {
        console.log(`🔇 [Anomaly] Anomaly suppressed for sensor ${reading.sensor_id}`);
      }
    }
  }
}

/**
 * Rule B: Rate of Change Detection
 * Compares current value against average of previous N readings
 * Triggers if % change exceeds threshold
 */
async function checkRateOfChange(
  reading: Reading,
  rules: SensorRule[],
  sensorSuppressed: boolean
): Promise<void> {
  const rateRules = rules.filter((r) => r.rule_type === 'rate_of_change');

  for (const rule of rateRules) {
    const config = rule.config as {
      field: string;
      threshold_pct: number;
      lookback_count: number;
    };

    const { field, threshold_pct, lookback_count = 3 } = config;
    const measurementKey = field as keyof Reading;
    const currentValue = reading[measurementKey] as number | null;

    // Skip if no current value
    if (currentValue === null || currentValue === undefined) continue;

    // Fetch previous readings for this sensor
    const prevResult = await pool.query(
      `SELECT ${field} FROM readings
       WHERE sensor_id = $1 AND id < $2
       ORDER BY id DESC LIMIT $3`,
      [reading.sensor_id, reading.id, lookback_count]
    );

    if (prevResult.rows.length < 1) continue;

    // Calculate average of previous readings
    const previousValues = prevResult.rows.map((r) => r[field]);
    const avgPrevious =
      previousValues.reduce((sum, val) => sum + (val || 0), 0) /
      previousValues.length;

    if (avgPrevious === 0) continue; // Avoid division issues

    // Calculate percentage change
    const changePct = Math.abs((currentValue - avgPrevious) / avgPrevious) * 100;

    if (changePct > threshold_pct) {
      console.log(
        `⚠️  [Anomaly] Rate of change: ${field} changed ${changePct.toFixed(
          1
        )}% (threshold: ${threshold_pct}%)`
      );

      // Create anomaly
      const anomalyResult = await pool.query(
        `INSERT INTO anomalies (reading_id, sensor_id, rule_id, rule_type, suppressed)
         VALUES ($1, $2, $3, 'rate_of_change', $4)
         RETURNING id`,
        [reading.id, reading.sensor_id, rule.id, sensorSuppressed]
      );

      const anomalyId = anomalyResult.rows[0].id;

      // Mark reading as having anomaly
      await pool.query(
        'UPDATE readings SET has_anomaly = true WHERE id = $1',
        [reading.id]
      );

      // Create alert if not suppressed
      if (!sensorSuppressed) {
        const alert = await createAlert(
          anomalyId,
          reading.sensor_id,
          rule.severity
        );

        // Update sensor state to severity level
        if (alert) {
          await updateSensorState(reading.sensor_id, rule.severity);
        }
      } else {
        console.log(`🔇 [Anomaly] Anomaly suppressed for sensor ${reading.sensor_id}`);
      }
    }
  }
}
