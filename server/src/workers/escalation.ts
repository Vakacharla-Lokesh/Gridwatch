import { pool } from '../db/index.js';
import { emitAlertEvent } from '../realtime/emitter.js';

/**
 * Auto-Escalation Worker
 *
 * Runs every 30 seconds to find critical alerts that have been open for > 5 minutes
 * and escalate them to a supervisor.
 *
 * Uses UNIQUE constraint on escalation_log(alert_id) to enforce exactly-once semantics:
 * - If worker fires twice, only one INSERT succeeds
 * - Only one escalation per alert, guaranteed at DB level
 */

/**
 * Check for alerts that need escalation
 * Critical alerts open for > 5 minutes without escalation
 */
export async function checkEscalation(): Promise<void> {
  try {
    // Find alerts that should be escalated
    const escalatableResult = await pool.query(
      `SELECT 
         a.id,
         a.assigned_to,
         a.created_at,
         s.zone_id,
         z.name as zone_name
       FROM alerts a
       JOIN sensors s ON s.id = a.sensor_id
       JOIN zones z ON z.id = s.zone_id
       WHERE a.status = 'open'
         AND a.severity = 'critical'
         AND a.escalated = FALSE
         AND a.created_at < NOW() - INTERVAL '5 minutes'
         AND NOT EXISTS (
           SELECT 1 FROM escalation_log el WHERE el.alert_id = a.id
         )
       ORDER BY a.created_at ASC`
    );

    const escalatable = escalatableResult.rows;

    if (escalatable.length === 0) return;

    console.log(
      `⏰ [Escalation] Found ${escalatable.length} alerts eligible for escalation`
    );

    // Find a supervisor (prefer one, or any supervisor)
    const supervisorResult = await pool.query(
      `SELECT id, email FROM users WHERE role = 'supervisor' LIMIT 1`
    );

    if (supervisorResult.rows.length === 0) {
      console.warn(
        `⚠️  [Escalation] No supervisors found, cannot escalate alerts`
      );
      return;
    }

    const supervisor = supervisorResult.rows[0];

    // Escalate each alert with UNIQUE constraint for exactly-once
    for (const alert of escalatable) {
      try {
        // Try to insert into escalation_log
        // If alert_id already exists, this fails silently due to ON CONFLICT DO NOTHING
        const escalationResult = await pool.query(
          `INSERT INTO escalation_log (alert_id, escalated_to)
           VALUES ($1, $2)
           ON CONFLICT (alert_id) DO NOTHING
           RETURNING alert_id`,
          [alert.id, supervisor.id]
        );

        if (escalationResult.rows.length === 0) {
          // Someone else already escalated this alert
          console.log(
            `ℹ️  [Escalation] Alert ${alert.id} already escalated by another process`
          );
          continue;
        }

        // Update alert to mark as escalated and reassign
        const updateResult = await pool.query(
          `UPDATE alerts 
           SET assigned_to = $1, escalated = TRUE
           WHERE id = $2 AND escalated = FALSE
           RETURNING id, sensor_id, severity`,
          [supervisor.id, alert.id]
        );

        if (updateResult.rows.length === 0) {
          console.log(
            `ℹ️  [Escalation] Alert ${alert.id} already escalated (race condition)`
          );
          continue;
        }

        const updatedAlert = updateResult.rows[0];

        // Log in audit
        await pool.query(
          `INSERT INTO alert_audit_log (alert_id, from_status, to_status)
           VALUES ($1, 'open', 'open')`,
          [alert.id]
        );

        // Get sensor name for real-time event
        const sensorNameResult = await pool.query(
          'SELECT name FROM sensors WHERE id = $1',
          [updatedAlert.sensor_id]
        );
        const sensorName = sensorNameResult.rows[0]?.name || `Sensor ${updatedAlert.sensor_id}`;

        // Emit real-time event (Phase 5)
        emitAlertEvent({
          alert_id: alert.id,
          sensor_id: updatedAlert.sensor_id,
          zone_id: alert.zone_id,
          type: 'escalated',
          severity: updatedAlert.severity,
          sensor_name: sensorName,
          assigned_to: supervisor.id,
          status: 'open',
          timestamp: new Date().toISOString(),
        });

        console.log(
          `🚨 [Escalation] Alert ${alert.id} escalated to supervisor ${supervisor.email} (open for ${Math.floor(
            (Date.now() - new Date(alert.created_at).getTime()) / 60000
          )} min)`
        );
      } catch (error) {
        console.error(`Error escalating alert ${alert.id}:`, error);
      }
    }

    console.log(`✅ [Escalation] Escalation check completed`);
  } catch (error) {
    console.error('[Escalation Worker] Error:', error);
    // Don't throw — worker runs on timer and should recover
  }
}

/**
 * Start the escalation worker timer
 * Runs every 30 seconds
 */
export function startEscalationWorker(): NodeJS.Timer {
  console.log(`🚀 [Escalation] Starting worker (checks every 30s)...`);

  // Run immediately first
  checkEscalation().catch((err) =>
    console.error('[Escalation] Initial check failed:', err)
  );

  // Then run every 30 seconds
  const timer = setInterval(() => {
    checkEscalation().catch((err) =>
      console.error('[Escalation] Periodic check failed:', err)
    );
  }, 30_000); // 30 seconds

  return timer;
}
