/**
 * API Response Types
 */

export interface Sensor {
  id: string;
  zone_id: string;
  name: string;
  current_state: "healthy" | "warning" | "critical" | "silent";
  last_reading_at: string | null;
  reading_count: number;
  open_alerts: number;
  zone_name?: string;
}

export interface Alert {
  id: string;
  anomaly_id: string;
  sensor_id: string;
  sensor_name: string;
  zone_id: string;
  zone_name: string;
  severity: "warning" | "critical";
  status: "open" | "acknowledged" | "resolved";
  assigned_to: string | null;
  assigned_to_email: string | null;
  escalated: boolean;
  suppressed: boolean;
  created_at: string;
  rule_type: string;
  rule_config: Record<string, unknown>;
  audit_count: number;
}

export interface Reading {
  id: number;
  sensor_id: string;
  timestamp: string;
  voltage: number;
  current: number;
  temperature: number;
  status_code: string;
  has_anomaly: boolean;
  anomaly_details: AnomalyDetail[] | null;
}

export interface AnomalyDetail {
  anomaly_id: string;
  rule_type: string;
  detected_at: string;
  suppressed: boolean;
  alert_id: string | null;
  alert_status: string | null;
  alert_severity: string | null;
}

export interface Suppression {
  id: string;
  sensor_id: string;
  created_by: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

export interface HistoryResponse {
  data: Reading[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  timeRange: {
    from: string;
    to: string;
  };
}

export interface RealTimeSensorEvent {
  sensor_id: string;
  zone_id: string;
  name: string;
  state: "healthy" | "warning" | "critical" | "silent";
  timestamp: string;
  severity?: "warning" | "critical";
}

export interface RealTimeAlertEvent {
  alert_id: string;
  sensor_id: string;
  zone_id: string;
  type: "created" | "acknowledged" | "resolved" | "escalated";
  severity: "warning" | "critical";
  sensor_name: string;
  assigned_to?: string;
  status: string;
  timestamp: string;
}

export interface RealTimeSuppressionEvent {
  suppression_id: string;
  sensor_id: string;
  zone_id: string;
  sensor_name: string;
  start_time: string;
  end_time: string;
  reason: string;
  timestamp: string;
}
