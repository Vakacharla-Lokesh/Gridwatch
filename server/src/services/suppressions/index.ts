/**
 * Suppression service
 *
 * Handles alert suppression logic:
 * - Check if a sensor is currently under suppression window
 * - Create new suppression windows
 * - List active suppressions
 * - Delete suppression windows
 */

export type { SuppressionWindow } from "./types.js";
export { isCurrentlySuppressed, getActiveSuppressionsForSensor, getSuppressionHistory } from "./queries.js";
export { createSuppression, deleteSuppression } from "./mutations.js";
