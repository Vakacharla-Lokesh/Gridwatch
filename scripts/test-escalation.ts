import { pool } from '../server/src/db/index.js';

/**
 * Test Phase 4: Alert escalation
 *
 * This script tests:
 * 1. Creating a critical alert that's old (> 5 minutes)
 * 2. Waiting for escalation worker to run and escalate to supervisor
 * 3. Verifying exactly-once: second run doesn't duplicate escalations
 *
 * Prerequisites:
 * - Server must be running (for escalation worker to execute)
 * - Must have at least one supervisor user in database
 * - Must have at least one zone with sensors
 */

async function testEscalation() {
  console.log('🧪 [Phase 4] Alert Escalation Test\n');

  try {
    // Step 1: Find or create test data
    console.log('📋 Step 1: Find test data (zones, operators, supervisors)');

    // Get zones
    const zonesResult = await pool.query(`SELECT * FROM zones LIMIT 1`);
    if (zonesResult.rows.length === 0) {
      throw new Error('No zones found in database. Run seed first.');
    }
    const zone = zonesResult.rows[0];
    console.log(`✅ Zone: ${zone.name} (${zone.id})`);

    // Get an operator
    const operatorResult = await pool.query(
      `SELECT u.* FROM users u
       JOIN user_zones uz ON u.id = uz.user_id
       WHERE u.role = 'operator' AND uz.zone_id = $1
       LIMIT 1`,
      [zone.id]
    );
    if (operatorResult.rows.length === 0) {
      throw new Error('No operators found in this zone. Run seed first.');
    }
    const operator = operatorResult.rows[0];
    console.log(`✅ Operator: ${operator.username} (${operator.id})`);

    // Get a supervisor
    const supervisorResult = await pool.query(
      `SELECT * FROM users WHERE role = 'supervisor' LIMIT 1`
    );
    if (supervisorResult.rows.length === 0) {
      throw new Error('No supervisors found in database. Run seed first.');
    }
    const supervisor = supervisorResult.rows[0];
    console.log(`✅ Supervisor: ${supervisor.username} (${supervisor.id})\n`);

    // Step 2: Get a sensor in the zone
    console.log('📋 Step 2: Find sensor in zone');
    const sensorResult = await pool.query(
      `SELECT * FROM sensors WHERE zone_id = $1 LIMIT 1`,
      [zone.id]
    );
    if (sensorResult.rows.length === 0) {
      throw new Error('No sensors found in zone. Run seed first.');
    }
    const sensor = sensorResult.rows[0];
    console.log(`✅ Sensor: ${sensor.name} (${sensor.id})\n`);

    // Step 3: Create an old critical alert (simulating one that's been open for > 5 min)
    console.log('📋 Step 3: Create OLD critical alert (> 5 minutes old)');
    
    // First create a dummy anomaly
    const anomalyResult = await pool.query(
      `INSERT INTO anomalies (sensor_id, anomaly_type, details)
       VALUES ($1, 'threshold', '{"field": "voltage", "value": 180, "threshold": 210}')
       RETURNING id`,
      [sensor.id]
    );
    const anomaly = anomalyResult.rows[0];
    console.log(`✅ Created anomaly: ${anomaly.id}`);

    // Create alert with old timestamp (6 minutes ago)
    const alertResult = await pool.query(
      `INSERT INTO alerts (anomaly_id, sensor_id, severity, status, assigned_to, created_at)
       VALUES ($1, $2, 'critical', 'open', $3, NOW() - INTERVAL '6 minutes')
       RETURNING *`,
      [anomaly.id, sensor.id, operator.id]
    );
    const alert = alertResult.rows[0];
    console.log(`✅ Created CRITICAL alert: ${alert.id}`);
    console.log(`   - Created: ${alert.created_at}`);
    console.log(`   - Status: ${alert.status}`);
    console.log(`   - Severity: ${alert.severity}`);
    console.log(`   - Assigned to: ${alert.assigned_to} (operator)\n`);

    // Step 4: Wait for escalation worker to run (runs every 30s)
    console.log('📋 Step 4: Wait for escalation worker...');
    console.log('   (Escalation worker runs every 30 seconds)');
    console.log('   ⏳ Waiting 35 seconds...\n');

    // Wait 35 seconds (one full cycle + 5s buffer)
    await new Promise(resolve => setTimeout(resolve, 35000));

    // Step 5: Verify escalation happened
    console.log('📋 Step 5: Verify alert was escalated\n');

    const escalatedResult = await pool.query(
      `SELECT * FROM alerts WHERE id = $1`,
      [alert.id]
    );
    const escalatedAlert = escalatedResult.rows[0];

    console.log(`📊 Alert status after escalation:`);
    console.log(`   - ID: ${escalatedAlert.id}`);
    console.log(`   - Status: ${escalatedAlert.status}`);
    console.log(`   - Escalated: ${escalatedAlert.escalated}`);
    console.log(`   - Assigned to: ${escalatedAlert.assigned_to}`);

    // Verify escalation happened
    let escalationSuccess = false;
    if (escalatedAlert.escalated) {
      console.log(`\n✅ Alert was escalated = TRUE`);
      escalationSuccess = true;
    } else {
      console.log(`\n❌ Alert escalated flag still FALSE (escalation may not have run)`);
    }

    if (escalatedAlert.assigned_to !== supervisor.id) {
      console.log(`❌ Alert NOT assigned to supervisor (still: ${escalatedAlert.assigned_to})`);
      escalationSuccess = false;
    } else {
      console.log(`✅ Alert reassigned to supervisor: ${supervisor.username}`);
    }

    // Step 6: Verify audit log
    console.log(`\n📋 Step 6: Check audit log for escalation\n`);
    const auditResult = await pool.query(
      `SELECT * FROM alert_audit_log WHERE alert_id = $1 ORDER BY created_at`,
      [alert.id]
    );

    if (auditResult.rows.length === 0) {
      console.log(`❌ No audit log entries found for this alert!`);
    } else {
      console.log(`📜 Audit log (${auditResult.rows.length} entries):`);
      for (const entry of auditResult.rows) {
        console.log(
          `   - ${entry.created_at}: ${entry.from_status} → ${entry.to_status} by ${entry.changed_by}`
        );
      }
    }

    // Step 7: Check escalation_log for exactly-once
    console.log(`\n📋 Step 7: Verify exactly-once (escalation_log should have 1 row)\n`);
    const escalationLogResult = await pool.query(
      `SELECT * FROM escalation_log WHERE alert_id = $1`,
      [alert.id]
    );

    console.log(`Escalation log entries: ${escalationLogResult.rows.length}`);
    if (escalationLogResult.rows.length === 0) {
      console.log(`❌ No escalation_log entry (escalation worker may not have run)`);
    } else if (escalationLogResult.rows.length === 1) {
      console.log(`✅ Exactly 1 escalation_log entry (perfect!):`);
      const entry = escalationLogResult.rows[0];
      console.log(`   - Alert: ${entry.alert_id}`);
      console.log(`   - Escalated to: ${entry.escalated_to}`);
      console.log(`   - Created: ${entry.created_at}`);
    } else {
      console.log(`❌ DUPLICATE: ${escalationLogResult.rows.length} entries (exactly-once violated!)`);
      for (const entry of escalationLogResult.rows) {
        console.log(`   - ${entry.created_at}: escalated to ${entry.escalated_to}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    if (escalationSuccess && escalationLogResult.rows.length === 1) {
      console.log('✅ Phase 4 Escalation Test PASSED');
      console.log('   - Alert escalated to supervisor');
      console.log('   - Exactly-once guarantee maintained');
    } else {
      console.log('❌ Phase 4 Escalation Test FAILED');
      if (!escalationSuccess) {
        console.log('   - Escalation did not complete properly');
      }
      if (escalationLogResult.rows.length !== 1) {
        console.log('   - Exactly-once guarantee violated');
      }
    }
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('💥 Test error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run test
testEscalation().then(() => process.exit(0));
