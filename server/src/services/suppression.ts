/**
 * Suppression service - backward compatibility entry point
 *
 * This file re-exports from the modularized suppression service.
 * New imports should use: import { ... } from "./suppressions/index.js"
 * But existing imports from this file will continue to work.
 */

export * from "./suppressions/index.js";
