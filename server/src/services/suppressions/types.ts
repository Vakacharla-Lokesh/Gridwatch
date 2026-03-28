/**
 * Suppression types
 */

export interface SuppressionWindow {
  id: string;
  sensor_id: string;
  created_by: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}
