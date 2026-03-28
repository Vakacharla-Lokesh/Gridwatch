import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { anomalyQueue } from "../workers/queue.js";

const router = Router();

/**
 * Validation schemas using Zod
 * Ensures type safety and clear error messages for invalid inputs
 */
const ReadingSchema = z.object({
  sensor_id: z.string().uuid("Invalid sensor_id format"),
  timestamp: z.string().datetime("Invalid timestamp format"),
  voltage: z
    .number()
    .finite("voltage must be a finite number")
    .nullable()
    .optional(),
  current: z
    .number()
    .finite("current must be a finite number")
    .nullable()
    .optional(),
  temperature: z
    .number()
    .finite("temperature must be a finite number")
    .nullable()
    .optional(),
  status_code: z.string().max(50, "status_code too long").optional(),
});

const BatchSchema = z
  .array(ReadingSchema)
  .max(1000, "Batch size exceeds 1000 readings");

export interface BulkInsertResult {
  accepted: number;
  readingIds: number[];
  processingTimeMs: number;
}

/**
 * POST /api/ingest
 *
 * Ingests a batch of sensor readings with strict < 200ms response time requirement.
 *
 * Pattern:
 * 1. Validate batch with Zod (fails fast on schema violations)
 * 2. Bulk INSERT into PostgreSQL (durable write before response)
 * 3. Push reading IDs to async queue (fire-and-forget)
 * 4. Return 202 Accepted immediately (no waiting for anomaly detection)
 *
 * Performance: Target < 200ms end-to-end
 * - Bulk insert with unnest: ~50-100ms for 1000 readings
 * - Zod validation: ~5-10ms
 * - Queue push (EventEmitter): < 1ms
 *
 * @param {Array<Reading>} req.body - Array of sensor readings
 * @returns {202} – Batch accepted, processing async
 * @returns {400} – Validation error (invalid schema)
 * @returns {500} – Database error
 */
router.post("/api/ingest", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Step 1: Validate batch schema
    const batch = BatchSchema.parse(req.body);

    if (batch.length === 0) {
      return res.status(400).json({ error: "Empty batch" });
    }

    // Step 2: Bulk INSERT — durable write to PostgreSQL
    const readingIds = await bulkInsertReadings(batch);

    // Step 3: Push to async queue (fire-and-forget, non-blocking)
    anomalyQueue.push(readingIds);

    const processingTimeMs = Date.now() - startTime;

    // Step 4: Return 202 Accepted immediately
    res.status(202).json({
      accepted: readingIds.length,
      processingTimeMs,
    });

    console.log(
      `📥 [Ingest] Accepted ${readingIds.length} readings in ${processingTimeMs}ms`,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Schema validation error - client mistake
      return res.status(400).json({
        error: "Invalid batch format",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    // Unexpected server error
    console.error("[Ingest] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Bulk insert readings using PostgreSQL unnest() for efficiency
 *
 * Why unnest instead of individual INSERTs?
 * - Single round-trip to database
 * - Automatic query batching
 * - ~100-200x faster than loop of individual INSERTs
 *
 * @param {Array<Reading>} readings - Validated reading objects
 * @returns {number[]} Array of inserted reading IDs
 */
async function bulkInsertReadings(
  readings: z.infer<typeof ReadingSchema>[],
): Promise<number[]> {
  if (readings.length === 0) return [];

  // Extract arrays for each column (required for unnest)
  const sensorIds = readings.map((r) => r.sensor_id);
  const timestamps = readings.map((r) => r.timestamp);
  const voltages = readings.map((r) => r.voltage ?? null);
  const currents = readings.map((r) => r.current ?? null);
  const temperatures = readings.map((r) => r.temperature ?? null);
  const statusCodes = readings.map((r) => r.status_code ?? null);

  const query = `
    INSERT INTO readings (sensor_id, timestamp, voltage, current, temperature, status_code)
    SELECT * FROM unnest(
      $1::uuid[],
      $2::timestamptz[],
      $3::numeric[],
      $4::numeric[],
      $5::numeric[],
      $6::text[]
    )
    RETURNING id
  `;

  const result = await pool.query(query, [
    sensorIds,
    timestamps,
    voltages,
    currents,
    temperatures,
    statusCodes,
  ]);

  return result.rows.map((row) => row.id);
}

export default router;
