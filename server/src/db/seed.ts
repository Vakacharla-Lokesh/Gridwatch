import { pool, shutdown } from './index.js';

/**
 * Seed script for GridWatch
 *
 * Creates test data:
 * - 3 zones
 * - 3 operators + 1 supervisor
 * - ~100 sensors per zone
 * - Sample readings and rules
 *
 * Run with: bun run src/db/seed.ts
 */

async function seed() {
  try {
    console.log('🌱 Seeding database...\n');

    // Step 1: Create zones
    console.log('Creating zones...');
    const zonesResult = await pool.query(`
      INSERT INTO zones (name) VALUES
      ('North Zone'),
      ('South Zone'),
      ('Central Zone')
      RETURNING id, name
    `);

    const zones = zonesResult.rows;
    console.log(`✅ Created ${zones.length} zones`);

    // Step 2: Create users
    console.log('Creating users...');
    const usersResult = await pool.query(`
      INSERT INTO users (email, role) VALUES
      ('operator.north@gridwatch.local', 'operator'),
      ('operator.south@gridwatch.local', 'operator'),
      ('operator.central@gridwatch.local', 'operator'),
      ('supervisor@gridwatch.local', 'supervisor')
      RETURNING id, email, role
    `);

    const [opNorth, opSouth, opCentral, supervisor] = usersResult.rows;
    console.log(`✅ Created ${usersResult.rows.length} users`);

    // Step 3: Assign zones to operators
    console.log('Assigning zones...');
    const assignmentResult = await pool.query(`
      INSERT INTO user_zones (user_id, zone_id) VALUES
      ($1, $2),
      ($3, $4),
      ($5, $6)
    `, [opNorth.id, zones[0].id, opSouth.id, zones[1].id, opCentral.id, zones[2].id]);

    console.log(`✅ Assigned zones to operators`);

    // Step 4: Create sensors for each zone
    console.log('Creating sensors...');
    const sensorsPerZone = 10; // Reduced for demo
    let sensorCount = 0;

    for (const zone of zones) {
      const sensorInserts = Array.from({ length: sensorsPerZone }, (_, i) => ({
        zone_id: zone.id,
        name: `${zone.name.split(' ')[0].toUpperCase()}-Sensor-${String(i + 1).padStart(3, '0')}`,
        current_state: Math.random() > 0.8 ? 'warning' : 'healthy',
        last_reading_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      }));

      for (const sensor of sensorInserts) {
        const result = await pool.query(
          `INSERT INTO sensors (zone_id, name, current_state, last_reading_at)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [sensor.zone_id, sensor.name, sensor.current_state, sensor.last_reading_at]
        );

        const sensorId = result.rows[0].id;

        // Create sample rules for each sensor
        // Rule 1: Voltage threshold (220-240V nominal)
        // Rule 2: Temperature rate of change (20% threshold)
        // Rule 3: Pattern absence (2 minute silence detection)
        await pool.query(
          `INSERT INTO sensor_rules (sensor_id, rule_type, config, severity)
           VALUES
           ($1, 'threshold', $2::jsonb, 'warning'),
           ($1, 'rate_of_change', $3::jsonb, 'critical'),
           ($1, 'pattern_absence', $4::jsonb, 'warning')`,
          [
            sensorId,
            JSON.stringify({
              field: 'voltage',
              min: 210,
              max: 250,
              severity: 'warning',
            }),
            JSON.stringify({
              field: 'temperature',
              threshold_pct: 25,
              lookback_count: 3,
              severity: 'critical',
            }),
            JSON.stringify({
              max_silence_seconds: 120,
              severity: 'warning',
            }),
          ]
        );

        sensorCount++;
      }
    }

    console.log(`✅ Created ${sensorCount} sensors with rules`);

    // Step 5: Create sample readings
    console.log('Creating sample readings...');
    let readingCount = 0;

    for (const zone of zones) {
      // Get sensors in this zone
      const sensorsInZone = await pool.query(
        'SELECT id FROM sensors WHERE zone_id = $1 LIMIT 10',
        [zone.id]
      );

      for (const sensor of sensorsInZone.rows) {
        // Create 50 readings over past 24 hours
        const readingInserts = Array.from({ length: 50 }, (_, i) => {
          const timestamp = new Date(Date.now() - (50 - i) * 30 * 60000); // 30 min apart
          return {
            sensor_id: sensor.id,
            timestamp,
            voltage: 220 + Math.random() * 20,
            current: 10 + Math.random() * 15,
            temperature: 25 + Math.random() * 30,
            status_code: Math.random() > 0.95 ? 'ERROR' : 'OK',
          };
        });

        // Batch insert readings
        if (readingInserts.length > 0) {
          const timestamps = readingInserts.map((r) => r.timestamp.toISOString());
          const voltages = readingInserts.map((r) => r.voltage);
          const currents = readingInserts.map((r) => r.current);
          const temperatures = readingInserts.map((r) => r.temperature);
          const statusCodes = readingInserts.map((r) => r.status_code);
          const sensorIds = readingInserts.map(() => sensor.id);

          const result = await pool.query(
            `INSERT INTO readings (sensor_id, timestamp, voltage, current, temperature, status_code)
             SELECT * FROM unnest(
               $1::uuid[],
               $2::timestamptz[],
               $3::numeric[],
               $4::numeric[],
               $5::numeric[],
               $6::text[]
             )`,
            [sensorIds, timestamps, voltages, currents, temperatures, statusCodes]
          );

          readingCount += readingInserts.length;
        }
      }
    }

    console.log(`✅ Created ${readingCount} readings\n`);

    // Print summary
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 Database seeding complete!');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('📊 Test Credentials:');
    console.log('───────────────────────────────────────────────────');
    console.log(`Operator (North):  ${opNorth.id}`);
    console.log(`Operator (South):  ${opSouth.id}`);
    console.log(`Operator (Central): ${opCentral.id}`);
    console.log(`Supervisor:        ${supervisor.id}`);
    console.log('───────────────────────────────────────────────────\n');

    console.log('📍 Test Zone IDs:');
    console.log('───────────────────────────────────────────────────');
    zones.forEach((z) => console.log(`${z.name}: ${z.id}`));
    console.log('───────────────────────────────────────────────────\n');

    console.log('🚀 Usage:');
    console.log(`GET /api/sensors (with header: x-user-id: ${opNorth.id})`);
    console.log(`POST /api/ingest (no auth required)`);
    console.log(
      `GET /health (for DB connection check)\n`
    );
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await shutdown();
  }
}

seed();
