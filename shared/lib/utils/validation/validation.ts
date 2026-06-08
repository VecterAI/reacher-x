/**
 * Shared validation utilities
 * Centralizes validation logic used across frontend and backend
 */

// Description validation constants
export const DESCRIPTION_CONSTRAINTS = {
  MIN_LENGTH: 64,
  MAX_LENGTH: 1000,
} as const;

// Workspace name validation constants
export const WORKSPACE_NAME_CONSTRAINTS = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 100,
} as const;

// Additional constraint sets for different contexts
export const VALIDATION_PRESETS = {
  DEFAULT: DESCRIPTION_CONSTRAINTS,
  SHORT_FORM: { MIN_LENGTH: 10, MAX_LENGTH: 100 },
  LONG_FORM: { MIN_LENGTH: 100, MAX_LENGTH: 1000 },
} as const;

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates user description for consistency across frontend and backend
 * @param description - The description to validate
 * @param isRequired - Whether the description is required (default: false)
 * @param constraints - Validation constraints to use (default: DESCRIPTION_CONSTRAINTS)
 * @returns Validation result with isValid flag and optional error message
 */
export function validateDescription(
  description: string | undefined | null,
  isRequired: boolean = false,
  constraints: typeof DESCRIPTION_CONSTRAINTS = DESCRIPTION_CONSTRAINTS
): ValidationResult {
  // Handle empty/null descriptions
  if (!description || description.trim() === "") {
    if (isRequired) {
      return {
        isValid: false,
        error: "Description is required",
      };
    }
    return { isValid: true }; // Optional description
  }

  if (typeof description !== "string") {
    return {
      isValid: false,
      error: "Description must be a string",
    };
  }

  const trimmedDescription = description.trim();

  if (trimmedDescription.length < constraints.MIN_LENGTH) {
    return {
      isValid: false,
      error: `Description must be at least ${constraints.MIN_LENGTH} characters`,
    };
  }

  if (trimmedDescription.length > constraints.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Description must not exceed ${constraints.MAX_LENGTH} characters`,
    };
  }

  return { isValid: true };
}
