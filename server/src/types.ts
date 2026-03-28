export interface User {
  id: string;
  email: string;
  role: "operator" | "supervisor";
  zones: string[];
}

export interface Zone {
  id: string;
  name: string;
}

export interface Sensor {
  id: string;
  zone_id: string;
  name: string;
  last_reading_at: string | null;
  current_state: "healthy" | "warning" | "critical" | "silent";
}

export interface Reading {
  id: number;
  sensor_id: string;
  timestamp: string;
  voltage: number | null;
  current: number | null;
  temperature: number | null;
  status_code: string | null;
  has_anomaly: boolean;
}

export interface SensorRule {
  id: string;
  sensor_id: string;
  rule_type: "threshold" | "rate_of_change" | "pattern_absence";
  config: Record<string, unknown>;
  severity: "warning" | "critical";
}

export interface Anomaly {
  id: string;
  reading_id: number | null;
  sensor_id: string;
  rule_id: string;
  rule_type: string;
  detected_at: string;
  suppressed: boolean;
}

export interface Alert {
  id: string;
  anomaly_id: string;
  sensor_id: string;
  assigned_to: string | null;
  severity: "warning" | "critical";
  status: "open" | "acknowledged" | "resolved";
  suppressed: boolean;
  escalated: boolean;
  created_at: string;
}

export interface Suppression {
  id: string;
  sensor_id: string;
  created_by: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}
