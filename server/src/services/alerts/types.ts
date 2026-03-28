/**
 * Alert types and constants
 */

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

// Valid state transitions - only forward transitions allowed
export const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["acknowledged", "resolved"],
  acknowledged: ["resolved"],
  resolved: [],
};
