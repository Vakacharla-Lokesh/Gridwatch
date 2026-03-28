import { EventEmitter } from 'events';
import { runAnomalyDetectionForReadings } from './anomaly.js';

/**
 * In-memory async queue for anomaly detection
 * 
 * Pattern: Fire-and-forget
 * - Ingest endpoint writes to DB (durable), then pushes reading IDs to queue
 * - Queue listener processes asynchronously without blocking the response
 * - If processing fails, it's logged for recovery (in production: dead-letter queue)
 */
const emitter = new EventEmitter();

// Set high listener limit to avoid warnings with many concurrent processing tasks
emitter.setMaxListeners(100);

export interface AnomalyQueueMessage {
  readingIds: (number | string)[];
  timestamp: number;
}

export const anomalyQueue = {
  /**
   * Push reading IDs to the anomaly detection queue (non-blocking)
   * Listener will pick them up immediately and process async
   */
  push: (readingIds: (number | string)[]) => {
    emitter.emit('process', {
      readingIds,
      timestamp: Date.now(),
    } as AnomalyQueueMessage);
  },
};

/**
 * Queue listener - processes anomaly detection batches
 * This runs independently and does NOT block the HTTP response
 */
emitter.on('process', async (message: AnomalyQueueMessage) => {
  try {
    const { readingIds, timestamp } = message;
    const processingTime = Date.now() - timestamp;

    console.log(
      `🔍 [Anomaly Worker] Processing ${readingIds.length} readings (queued for ${processingTime}ms)`
    );

    // Run anomaly detection for this batch of readings
    await runAnomalyDetectionForReadings(readingIds);

    console.log(
      `✅ [Anomaly Worker] Completed batch of ${readingIds.length} readings`
    );
  } catch (error) {
    console.error('❌ [Anomaly Worker] Error processing batch:', error);
    // In production: push to dead-letter queue for retry logic
    // For now: logged as-is for manual recovery
  }
});

export default anomalyQueue;
