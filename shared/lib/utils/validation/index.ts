/**
 * Validation utilities
 */

// Description validation
export {
  DESCRIPTION_CONSTRAINTS,
  WORKSPACE_NAME_CONSTRAINTS,
  VALIDATION_PRESETS,
  validateDescription,
} from "./validation";
export type { ValidationResult } from "./validation";

// Query limits
export { QUERY_CHAR_LIMIT, computeEffectiveLength } from "./queryLimit";
