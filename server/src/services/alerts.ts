/**
 * Alert service - backward compatibility entry point
 *
 * This file re-exports from the modularized alert service.
 * New imports should use: import { ... } from "./alerts/index.js"
 * But existing imports from this file will continue to work.
 */

export * from "./alerts/index.js";
