-- Zones
CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

-- Users (operators + supervisors)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('operator', 'supervisor')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zone assignments (operators only)
CREATE TABLE user_zones (
  user_id UUID REFERENCES users(id),
  zone_id UUID REFERENCES zones(id),
  PRIMARY KEY (user_id, zone_id)
);

-- Sensors
CREATE TABLE sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES zones(id) NOT NULL,
  name TEXT,
  last_reading_at TIMESTAMPTZ,
  current_state TEXT DEFAULT 'healthy' CHECK (current_state IN ('healthy', 'warning', 'critical', 'silent'))
);

-- Sensor detection rules
CREATE TABLE sensor_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID REFERENCES sensors(id),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('threshold', 'rate_of_change', 'pattern_absence')),
  config JSONB NOT NULL,
  -- threshold: { field, min, max, severity }
  -- rate_of_change: { field, threshold_pct, severity }
  -- pattern_absence: { max_silence_seconds, severity }
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical'))
);

-- Raw readings
CREATE TABLE readings (
  id BIGSERIAL PRIMARY KEY,
  sensor_id UUID REFERENCES sensors(id) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  voltage NUMERIC,
  current NUMERIC,
  temperature NUMERIC,
  status_code TEXT,
  has_anomaly BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_readings_sensor_time ON readings(sensor_id, timestamp DESC);
CREATE INDEX idx_readings_timestamp ON readings(timestamp DESC);

-- Anomalies
CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id BIGINT REFERENCES readings(id),
  sensor_id UUID REFERENCES sensors(id),
  rule_id UUID REFERENCES sensor_rules(id),
  rule_type TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  suppressed BOOLEAN DEFAULT FALSE
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id UUID REFERENCES anomalies(id),
  sensor_id UUID REFERENCES sensors(id),
  assigned_to UUID REFERENCES users(id),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  suppressed BOOLEAN DEFAULT FALSE,
  escalated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_alerts_sensor ON alerts(sensor_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created ON alerts(created_at);

-- Alert audit log (append-only)
CREATE TABLE alert_audit_log (
  id BIGSERIAL PRIMARY KEY,
  alert_id UUID REFERENCES alerts(id),
  changed_by UUID REFERENCES users(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escalation log
CREATE TABLE escalation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id) UNIQUE, -- UNIQUE ensures exactly-once
  escalated_to UUID REFERENCES users(id),
  escalated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert suppression windows
CREATE TABLE suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID REFERENCES sensors(id),
  created_by UUID REFERENCES users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT
);
CREATE INDEX idx_suppressions_sensor_time ON suppressions(sensor_id, start_time, end_time);