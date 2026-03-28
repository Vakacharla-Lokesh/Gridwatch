/**
 * Test the ingest endpoint
 *
 * Usage: bun run scripts/test-ingest.ts
 *
 * This script sends sample sensor readings to the ingest endpoint
 * and measures the response time.
 */

async function testIngest() {
  const BASE_URL = process.env.API_URL || 'http://localhost:4000';
  const SENSOR_COUNT = 5; // Number of sensors
  const READINGS_PER_SENSOR = 100; // Readings per sensor

  console.log('🧪 Testing ingest endpoint...\n');
  console.log(`📍 Target: ${BASE_URL}/api/ingest`);
  console.log(`📦 Batch size: ${SENSOR_COUNT * READINGS_PER_SENSOR} readings\n`);

  // Generate test readings
  const readings = [];
  const sensorIds = Array.from({ length: SENSOR_COUNT }, (_, i) =>
    '550e8400-e29b-41d4-a716-446655440'.padEnd(36, String(i))
  );

  for (const sensorId of sensorIds) {
    for (let i = 0; i < READINGS_PER_SENSOR; i++) {
      const timestamp = new Date(Date.now() - i * 60000).toISOString();
      readings.push({
        sensor_id: sensorId,
        timestamp,
        voltage: 220 + Math.random() * 20,
        current: 10 + Math.random() * 15,
        temperature: 25 + Math.random() * 30,
        status_code: Math.random() > 0.95 ? 'ERROR' : 'OK',
      });
    }
  }

  try {
    console.log(`📤 Sending ${readings.length} readings...`);
    const startTime = performance.now();

    const response = await fetch(`${BASE_URL}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(readings),
    });

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Error (${response.status}):`, error);
      process.exit(1);
    }

    const result = (await response.json()) as { accepted: number; processingTimeMs: number };

    console.log('\n✅ Ingest successful!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Status:          ${response.status} Accepted`);
    console.log(`Readings sent:   ${readings.length}`);
    console.log(`Readings stored: ${result.accepted}`);
    console.log(`Response time:   ${responseTime.toFixed(2)}ms`);
    console.log(`Target time:     < 200ms`);
    console.log(
      `⏱️  ${
        responseTime < 200 ? '✅ PASS' : '❌ FAIL'
      } (${responseTime < 200 ? 'under' : 'over'} 200ms)`
    );
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test validation error
    console.log('🧪 Testing validation error handling...\n');

    const invalidBatch = [
      {
        sensor_id: 'invalid-uuid',
        timestamp: 'not-a-datetime',
        voltage: 'not-a-number',
      },
    ];

    const errorResponse = await fetch(`${BASE_URL}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidBatch),
    });

    if (errorResponse.status === 400) {
      const errorData = (await errorResponse.json()) as { error: string; details?: Array<{ path: string; message: string }> };
      console.log(`✅ Validation working correctly`);
      console.log(`   Status: ${errorResponse.status}`);
      console.log(`   Errors: ${errorData.details?.length || 0} validation issues found\n`);
    } else {
      console.log(`❌ Expected 400 error, got ${errorResponse.status}\n`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testIngest();
