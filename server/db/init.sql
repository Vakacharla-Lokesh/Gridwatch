-- GridWatch Database Schema
-- Complete initialization of all tables and relationships

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ ZONES ============
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ USERS ============
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'operator',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ USER-ZONE ASSIGNMENTS ============
CREATE TABLE IF NOT EXISTS user_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, zone_id)
);

-- ============ SENSORS ============
CREATE TABLE IF NOT EXISTS sensors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  current_state VARCHAR(50) NOT NULL DEFAULT 'unknown',
  last_reading TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(zone_id, name)
);

-- ============ READINGS ============
CREATE TABLE IF NOT EXISTS readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  voltage NUMERIC NOT NULL,
  current NUMERIC NOT NULL,
  temperature NUMERIC NOT NULL,
  has_anomaly BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_readings_sensor_timestamp 
  ON readings(sensor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_readings_timestamp 
  ON readings(timestamp DESC);

-- ============ SENSOR RULES ============
CREATE TABLE IF NOT EXISTS sensor_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  rule_type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  severity VARCHAR(50),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ ANOMALIES ============
CREATE TABLE IF NOT EXISTS anomalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reading_id UUID NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES sensor_rules(id) ON DELETE SET NULL,
  rule_type VARCHAR(50) NOT NULL,
  detected_at TIMESTAMP NOT NULL,
  suppressed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_anomalies_sensor_detected 
  ON anomalies(sensor_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected_at 
  ON anomalies(detected_at DESC);

-- ============ ALERTS ============
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  anomaly_id UUID REFERENCES anomalies(id) ON DELETE CASCADE,
  severity VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_sensor_status 
  ON alerts(sensor_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_status_created 
  ON alerts(status, created_at DESC);

-- ============ SUPPRESSIONS ============
CREATE TABLE IF NOT EXISTS suppressions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES sensor_rules(id) ON DELETE CASCADE,
  reason VARCHAR(255),
  suppressed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  suppressed_until TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suppressions_sensor_until 
  ON suppressions(sensor_id, suppressed_until);
CREATE INDEX IF NOT EXISTS idx_suppressions_active 
  ON suppressions(suppressed_until) WHERE suppressed_until > CURRENT_TIMESTAMP;

-- ============ ESCALATIONS ============
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  escalation_level INT NOT NULL DEFAULT 1,
  escalated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  escalated_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escalations_status 
  ON escalations(status);
