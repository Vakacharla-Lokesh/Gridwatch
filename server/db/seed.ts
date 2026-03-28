/**
 * Seed Data Generator for GridWatch
 * Creates 3 zones with ~100 sensors each, operators, supervisors, and 48h of sample readings
 * Usage: bun db/seed.ts
 */

import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://gridwatch:secret@localhost:5432/gridwatch";
const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * Sensor state logic: based on reading values
 * - voltage < 200V || > 250V → critical
 * - current < 5A || > 20A → critical
 * - temp < 20°C || > 50°C → critical
 * - Otherwise healthy
 */
function determineSensorState(
  voltage: number,
  current: number,
  temp: number,
): string {
  if (
    voltage < 200 ||
    voltage > 250 ||
    current < 5 ||
    current > 20 ||
    temp < 20 ||
    temp > 50
  ) {
    return "critical";
  }
  if (
    voltage < 210 ||
    voltage > 240 ||
    current < 10 ||
    current > 18 ||
    temp < 25 ||
    temp > 45
  ) {
    return "warning";
  }
  return "healthy";
}

/**
 * Generate random realistic sensor readings
 */
function generateReading() {
  const voltage = 220 + (Math.random() - 0.5) * 20; // ~220V ± 10V
  const current = 12 + (Math.random() - 0.5) * 4; // ~12A ± 2A
  const temp = 35 + (Math.random() - 0.5) * 10; // ~35°C ± 5°C

  return {
    voltage: Math.round(voltage * 100) / 100,
    current: Math.round(current * 100) / 100,
    temp: Math.round(temp * 100) / 100,
  };
}

/**
 * Generate anomalous readings (outliers)
 */
function generateAnomalousReading() {
  const type = Math.floor(Math.random() * 3);
  let voltage = 220;
  let current = 12;
  let temp = 35;

  if (type === 0) {
    voltage = 180 + Math.random() * 20; // Low voltage
  } else if (type === 1) {
    current = 25 + Math.random() * 5; // High current
  } else {
    temp = 55 + Math.random() * 10; // High temp
  }

  return {
    voltage: Math.round(voltage * 100) / 100,
    current: Math.round(current * 100) / 100,
    temp: Math.round(temp * 100) / 100,
  };
}

async function seed() {
  const client = await pool.connect();

  try {
    console.log("🌱 Starting GridWatch seed...\n");

    // ============ ZONES ============
    console.log("📍 Creating zones...");
    const zoneRows = await client.query(`
      INSERT INTO zones (name) VALUES
      ('North'), ('South'), ('Central')
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `);
    const zones = zoneRows.rows.map((z: any) => ({ id: z.id, name: z.name }));
    console.log(`   ✓ Created ${zones.length} zones\n`);

    // ============ USERS ============
    console.log("👥 Creating operators and supervisor...");
    const userRows = await client.query(`
      INSERT INTO users (email, role) VALUES
      ('op_north@gridwatch.local', 'operator'),
      ('op_south@gridwatch.local', 'operator'),
      ('supervisor@gridwatch.local', 'supervisor')
      ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
      RETURNING id, email, role
    `);
    const users = userRows.rows;
    console.log(`   ✓ Created ${users.length} users`);
    users.forEach((u: any) => console.log(`      - ${u.email} (${u.role})`));
    console.log();

    // ============ ZONE ASSIGNMENTS ============
    console.log("🔗 Assigning operators to zones...");
    const op_north = users.find(
      (u: any) => u.email === "op_north@gridwatch.local",
    );
    const op_south = users.find(
      (u: any) => u.email === "op_south@gridwatch.local",
    );
    const zone_north = zones.find((z: any) => z.name === "North");
    const zone_south = zones.find((z: any) => z.name === "South");

    await client.query(
      `
      INSERT INTO user_zones (user_id, zone_id) VALUES
      ($1, $2), ($3, $4)
      ON CONFLICT DO NOTHING
    `,
      [op_north.id, zone_north.id, op_south.id, zone_south.id],
    );
    console.log(`   ✓ Assigned operators to zones\n`);

    // ============ SENSORS & RULES ============
    console.log("⚡ Creating sensors and rules...");
    const SENSORS_PER_ZONE = 100;
    let sensorCount = 0;
    let ruleCount = 0;

    for (const zone of zones) {
      for (let i = 0; i < SENSORS_PER_ZONE; i++) {
        const sensorRows = await client.query(
          `
          INSERT INTO sensors (zone_id, name, current_state)
          VALUES ($1, $2, 'healthy')
          ON CONFLICT DO NOTHING
          RETURNING id
        `,
          [zone.id, `${zone.name}-Sensor-${i + 1}`],
        );

        if (sensorRows.rows.length === 0) continue;
        sensorCount++;

        const sensorId = sensorRows.rows[0].id;

        // Create rules for this sensor (threshold, rate_of_change, pattern_absence)
        const rules = [
          {
            rule_type: "threshold",
            config: JSON.stringify({
              field: "voltage",
              min: 200,
              max: 250,
              severity: "critical",
            }),
            severity: "critical",
          },
          {
            rule_type: "threshold",
            config: JSON.stringify({
              field: "current",
              min: 5,
              max: 20,
              severity: "critical",
            }),
            severity: "critical",
          },
          {
            rule_type: "rate_of_change",
            config: JSON.stringify({
              field: "temperature",
              threshold_pct: 15,
              severity: "warning",
            }),
            severity: "warning",
          },
          {
            rule_type: "pattern_absence",
            config: JSON.stringify({ max_silence_seconds: 300 }),
            severity: "warning",
          },
        ];

        for (const rule of rules) {
          await client.query(
            `
            INSERT INTO sensor_rules (sensor_id, rule_type, config, severity)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
          `,
            [sensorId, rule.rule_type, rule.config, rule.severity],
          );
          ruleCount++;
        }
      }
    }
    console.log(
      `   ✓ Created ${sensorCount} sensors with ${ruleCount} rules\n`,
    );

    // ============ READINGS & ANOMALIES ============
    console.log("📊 Generating 48h of readings (sampling 100 sensors)...");

    // Get all sensors
    const sensorsRows = await client.query(
      "SELECT id, zone_id FROM sensors ORDER BY RANDOM() LIMIT 100",
    );
    const sampledSensors = sensorsRows.rows;

    let readingCount = 0;
    let anomalyCount = 0;
    let alertCount = 0;

    for (const sensor of sampledSensors) {
      // Generate 500 readings per sensor (48h × 3600s / 10s = 17,280; we'll do 500 for speed)
      const startTime = new Date(Date.now() - 48 * 3600 * 1000); // 48h ago

      for (let i = 0; i < 500; i++) {
        const timestamp = new Date(
          startTime.getTime() + i * ((48 * 3600 * 1000) / 500),
        ); // Spread across 48h
        const isAnomaly = Math.random() < 0.05; // 5% anomaly rate
        const { voltage, current, temp } = isAnomaly
          ? generateAnomalousReading()
          : generateReading();
        const state = determineSensorState(voltage, current, temp);

        const readingRows = await client.query(
          `
          INSERT INTO readings (sensor_id, timestamp, voltage, current, temperature, has_anomaly)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
          [
            sensor.id,
            timestamp.toISOString(),
            voltage,
            current,
            temp,
            isAnomaly,
          ],
        );

        if (readingRows.rows.length === 0) continue;
        readingCount++;

        // If anomaly, create anomaly record and possibly alert
        if (isAnomaly) {
          const readingId = readingRows.rows[0].id;
          const rulesResult = await client.query(
            "SELECT id FROM sensor_rules WHERE sensor_id = $1 LIMIT 1",
            [sensor.id],
          );

          if (rulesResult.rows.length > 0) {
            const ruleId = rulesResult.rows[0].id;
            const anomalyRows = await client.query(
              `
              INSERT INTO anomalies (reading_id, sensor_id, rule_id, rule_type, detected_at, suppressed)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id
            `,
              [
                readingId,
                sensor.id,
                ruleId,
                "threshold",
                timestamp.toISOString(),
                Math.random() < 0.2,
              ],
            );

            if (anomalyRows.rows.length > 0) {
              anomalyCount++;

              // Create alert (~50% of anomalies become alerts)
              if (Math.random() < 0.5) {
                const anomalyId = anomalyRows.rows[0].id;
                const severity = Math.random() < 0.7 ? "warning" : "critical";
                const status =
                  Math.random() < 0.3
                    ? "open"
                    : Math.random() < 0.5
                      ? "acknowledged"
                      : "resolved";

                const alertRows = await client.query(
                  `
                  INSERT INTO alerts (anomaly_id, sensor_id, severity, status, escalated)
                  VALUES ($1, $2, $3, $4, $5)
                  RETURNING id
                `,
                  [anomalyId, sensor.id, severity, status, Math.random() < 0.2],
                );

                if (alertRows.rows.length > 0) {
                  alertCount++;

                  // Write audit log
                  await client.query(
                    `
                    INSERT INTO alert_audit_log (alert_id, from_status, to_status)
                    VALUES ($1, NULL, $2)
                  `,
                    [alertRows.rows[0].id, status],
                  );
                }
              }
            }
          }
        }
      }
    }
    console.log(
      `   ✓ Created ${readingCount} readings, ${anomalyCount} anomalies, ${alertCount} alerts\n`,
    );

    // ============ SUPPRESSIONS ============
    console.log("🔇 Creating sample suppressions...");
    let suppressionCount = 0;

    for (let i = 0; i < 10; i++) {
      const sensor =
        sampledSensors[Math.floor(Math.random() * sampledSensors.length)];
      const startTime = new Date(Date.now() - Math.random() * 48 * 3600 * 1000);
      const endTime = new Date(startTime.getTime() + 3600 * 1000); // 1 hour window

      await client.query(
        `
        INSERT INTO suppressions (sensor_id, created_by, start_time, end_time, reason)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `,
        [
          sensor.id,
          op_north.id,
          startTime.toISOString(),
          endTime.toISOString(),
          "Scheduled maintenance",
        ],
      );
      suppressionCount++;
    }
    console.log(`   ✓ Created ${suppressionCount} suppressions\n`);

    console.log("✅ Seed data created successfully!\n");
    console.log("📋 Test Credentials:");
    console.log("   Operator (North): op_north@gridwatch.local");
    console.log("   Operator (South): op_south@gridwatch.local");
    console.log("   Supervisor:       supervisor@gridwatch.local");
    console.log("\n🚀 Start with: docker-compose up\n");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run seed
seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
