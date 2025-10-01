/**
 * Prompt Safety and Sanitization Utilities
 *
 * This module provides utilities for safely handling user input in LLM prompts
 * to prevent prompt injection attacks and ensure robust prompt construction.
 *
 * References:
 * - OWASP Guide on LLM Security: https://owasp.org/www-project-top-10-for-large-language-model-applications/
 * - Prompt Injection Prevention: https://learnprompting.org/docs/prompt_hacking/injection
 * - Security best practices for AI systems
 */

import { logger } from "../logger";

/**
 * Sanitizes user input to prevent prompt injection attacks
 *
 * This function escapes potentially dangerous characters that could be used
 * to manipulate LLM prompts and cause unintended behavior.
 *
 * @param text - The user input text to sanitize
 * @returns Sanitized text safe for use in LLM prompts
 */
export function sanitizeForPrompt(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  return (
    text
      // Escape backslashes first (must be done before other escapes)
      .replace(/\\/g, "\\\\")
      // Escape double quotes to prevent breaking out of quoted sections
      .replace(/"/g, '\\"')
      // Escape single quotes for additional safety
      .replace(/'/g, "\\'")
      // Replace newlines with escaped newlines to maintain prompt structure
      .replace(/\n/g, "\\n")
      // Replace carriage returns
      .replace(/\r/g, "\\r")
      // Replace tabs with spaces to maintain readability
      .replace(/\t/g, "    ")
      // Remove any control characters that could interfere with prompt parsing
      .replace(/[\x00-\x1F\x7F]/g, "")
      // Trim whitespace
      .trim()
  );
}

/**
 * Validates that text is safe for use in prompts after sanitization
 *
 * @param text - The text to validate
 * @returns Object with validation result and any warnings
 */
export function validatePromptInput(text: string): {
  isValid: boolean;
  warnings: string[];
  sanitized: string;
} {
  const warnings: string[] = [];

  if (!text || typeof text !== "string") {
    return {
      isValid: false,
      warnings: ["Input must be a non-empty string"],
      sanitized: "",
    };
  }

  // Check for potentially suspicious patterns
  const suspiciousPatterns = [
    /ignore\s+(?:previous|all)\s+instructions?/i,
    /system\s*:\s*/i,
    /user\s*:\s*/i,
    /assistant\s*:\s*/i,
    /\[INST\]/i,
    /\[\/INST\]/i,
    /<\|.*?\|>/g,
  ];

  suspiciousPatterns.forEach((pattern, index) => {
    if (pattern.test(text)) {
      warnings.push(
        `Potentially suspicious pattern detected (pattern ${index + 1})`
      );
    }
  });

  // Check for excessive length
  if (text.length > 10000) {
    warnings.push("Input is unusually long, consider truncating");
  }

  const sanitized = sanitizeForPrompt(text);

  return {
    isValid: true,
    warnings,
    sanitized,
  };
}

/**
 * Safely constructs a prompt section with user input
 *
 * @param label - The label for the input (e.g., "User Description")
 * @param userInput - The user input to include
 * @param fallback - Fallback text if input is empty/invalid
 * @returns Safely constructed prompt section
 */
export function createPromptSection(
  label: string,
  userInput: string | null | undefined,
  fallback: string = "None provided"
): string {
  if (!userInput || typeof userInput !== "string" || userInput.trim() === "") {
    return `${label}: "${fallback}"`;
  }

  const validation = validatePromptInput(userInput);

  // Log warnings in development (unified logger)
  if (
    process.env.NODE_ENV === "development" &&
    validation.warnings.length > 0
  ) {
    logger.warn(`[PROMPT_SAFETY] Warnings for ${label}:`, validation.warnings);
  }

  return `${label}: "${validation.sanitized}"`;
}

/**
 * Type guard to check if a value is a safe string for prompts
 */
export function isSafePromptInput(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 10000
  );
}
