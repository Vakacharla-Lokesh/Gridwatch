/**
 * Alert service
 *
 * Handles alert lifecycle:
 * - Create alerts from anomalies (unless suppressed)
 * - Assign to zone operators
 * - Track audit log
 * - Enforce state machine (open → acknowledged/resolved, acknowledged → resolved)
 */

export type { Alert } from "./types.js";
export { VALID_TRANSITIONS } from "./types.js";
export { createAlert } from "./create.js";
export { getOpenAlertsForSensor } from "./queries.js";
export { acknowledgeAlert, resolveAlert } from "./state.js";
