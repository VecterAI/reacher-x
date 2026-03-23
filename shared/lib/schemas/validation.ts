/**
 * Shared validation schemas using Zod
 * Centralizes validation rules across frontend components
 */

import { z } from "zod";
import {
  DESCRIPTION_CONSTRAINTS,
  WORKSPACE_NAME_CONSTRAINTS,
} from "../utils/validation";
import { WORKSPACE_USE_CASE_KEYS } from "../workspaceUseCases";

/** ICP short description / textarea (Figma 512 cap on profile edit). */
export const ICP_SHORT_DESCRIPTION_MAX = 512;

/**
 * Description validation schema
 * Used for onboarding and other description inputs
 */
export const descriptionSchema = z
  .string()
  .min(DESCRIPTION_CONSTRAINTS.MIN_LENGTH, {
    error: `Description must be at least ${DESCRIPTION_CONSTRAINTS.MIN_LENGTH} characters.`,
  })
  .max(DESCRIPTION_CONSTRAINTS.MAX_LENGTH, {
    error: `Description must not be longer than ${DESCRIPTION_CONSTRAINTS.MAX_LENGTH} characters.`,
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
  .email({ error: "Please enter a valid email address." })
  .min(1, { error: "Email is required." })
  .transform((val) => val.toLowerCase());

/**
 * Twitter handle validation schema
 * Validates X/Twitter usernames
 */
export const twitterHandleSchema = z
  .string()
  .trim()
  .refine((val) => val === "" || /^[a-zA-Z0-9_]{1,15}$/.test(val), {
    error:
      "Invalid Twitter handle. It should be 1-15 characters long and contain only letters, numbers, and underscores.",
  })
  .transform((val) => (val === "" ? undefined : val))
  .optional();

/**
 * Terms acceptance schema
 * For terms and conditions checkboxes
 */
export const termsSchema = z.boolean().refine((val) => val === true, {
  error: "You must accept the terms.",
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
 * Workspace name validation schema
 */
export const workspaceNameSchema = z
  .string()
  .min(WORKSPACE_NAME_CONSTRAINTS.MIN_LENGTH, {
    error: `Workspace name is required.`,
  })
  .max(WORKSPACE_NAME_CONSTRAINTS.MAX_LENGTH, {
    error: `Workspace name must not exceed ${WORKSPACE_NAME_CONSTRAINTS.MAX_LENGTH} characters.`,
  })
  .trim();

const workspaceUseCaseKeySchema = z.enum(
  WORKSPACE_USE_CASE_KEYS as unknown as [string, ...string[]]
);

export const icpFormEntrySchema = z.object({
  title: z.string().max(200),
  description: z.string().max(ICP_SHORT_DESCRIPTION_MAX, {
    error: `Short description must be at most ${ICP_SHORT_DESCRIPTION_MAX} characters.`,
  }),
  painPoints: z.array(z.string()),
  channels: z.array(z.string()),
});

/**
 * Full workspace page (Details + Profiles) edit form.
 */
export const workspacePageFormSchema = z
  .object({
    name: workspaceNameSchema,
    useCaseKey: workspaceUseCaseKeySchema,
    /** Seed / user description */
    seedDescription: z.string().max(DESCRIPTION_CONSTRAINTS.MAX_LENGTH + 50),
    improvedDescription: z
      .string()
      .max(DESCRIPTION_CONSTRAINTS.MAX_LENGTH + 50),
    sourceUrl: z.string().max(2048).optional(),
    icps: z.array(icpFormEntrySchema).min(3, {
      error: "At least three ideal customer profiles are required.",
    }),
  })
  .superRefine((data, ctx) => {
    data.icps.forEach((icp, i) => {
      if (!icp.title.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Profile name is required.",
          path: ["icps", i, "title"],
        });
      }
    });
  });

export type WorkspacePageFormValues = z.infer<typeof workspacePageFormSchema>;
export type IcpFormEntryValues = z.infer<typeof icpFormEntrySchema>;

/**
 * Workspace draft schema
 * Used while loading/hydrating existing workspaces that can be incomplete.
 * Enforces only upper bounds; submit-time checks use workspaceSchema.
 */
export const workspaceDraftSchema = z.object({
  name: z.string().max(WORKSPACE_NAME_CONSTRAINTS.MAX_LENGTH, {
    error: `Workspace name must not exceed ${WORKSPACE_NAME_CONSTRAINTS.MAX_LENGTH} characters.`,
  }),
  description: z.string().max(DESCRIPTION_CONSTRAINTS.MAX_LENGTH, {
    error: `Description must not be longer than ${DESCRIPTION_CONSTRAINTS.MAX_LENGTH} characters.`,
  }),
});

/**
 * Waitlist form schema
 */
export const waitlistSchema = z.object({
  email: emailSchema,
  twitter: twitterHandleSchema,
  terms: termsSchema,
});

/**
 * Workspace form schema
 */
export const workspaceSchema = z.object({
  name: workspaceNameSchema,
  description: descriptionSchema,
});

export type WaitlistFormValues = z.infer<typeof waitlistSchema>;
export type WorkspaceFormValues = z.infer<typeof workspaceSchema>;
