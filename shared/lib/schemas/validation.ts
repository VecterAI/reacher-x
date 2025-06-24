/**
 * Shared validation schemas using Zod
 * Centralizes validation rules across frontend components
 */

import { z } from "zod";
import { DESCRIPTION_CONSTRAINTS } from "../utils/validation";

/**
 * Description validation schema
 * Used for onboarding and other description inputs
 */
export const descriptionSchema = z
  .string()
  .min(DESCRIPTION_CONSTRAINTS.MIN_LENGTH, {
    message: `Description must be at least ${DESCRIPTION_CONSTRAINTS.MIN_LENGTH} characters.`,
  })
  .max(DESCRIPTION_CONSTRAINTS.MAX_LENGTH, {
    message: `Description must not be longer than ${DESCRIPTION_CONSTRAINTS.MAX_LENGTH} characters.`,
  });

/**
 * Optional description schema
 * For forms where description is not required
 */
export const optionalDescriptionSchema = descriptionSchema.optional();

/**
 * Email validation schema
 * Common email validation used across forms
 */
export const emailSchema = z
  .string()
  .email({ message: "Please enter a valid email address." })
  .nonempty({ message: "Email is required." })
  .transform((val) => val.toLowerCase());

/**
 * Twitter handle validation schema
 * Validates X/Twitter usernames
 */
export const twitterHandleSchema = z
  .string()
  .trim()
  .refine((val) => val === "" || /^[a-zA-Z0-9_]{1,15}$/.test(val), {
    message:
      "Invalid Twitter handle. It should be 1-15 characters long and contain only letters, numbers, and underscores.",
  })
  .transform((val) => (val === "" ? undefined : val))
  .optional();

/**
 * Terms acceptance schema
 * For terms and conditions checkboxes
 */
export const termsSchema = z.boolean().refine((val) => val === true, {
  message: "You must accept the terms.",
});

/**
 * Common form schemas
 */
export const commonSchemas = {
  description: descriptionSchema,
  optionalDescription: optionalDescriptionSchema,
  email: emailSchema,
  twitterHandle: twitterHandleSchema,
  terms: termsSchema,
} as const;

/**
 * Onboarding form schema
 */
export const onboardingSchema = z.object({
  description: descriptionSchema,
});

/**
 * Waitlist form schema
 */
export const waitlistSchema = z.object({
  email: emailSchema,
  twitter: twitterHandleSchema,
  terms: termsSchema,
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
export type WaitlistFormValues = z.infer<typeof waitlistSchema>;
