// convex/agents/tools/schemas.ts
// Shared Zod schemas for agent tools

import { z } from "zod";

// ============================================================================
// ICP Schema
// ============================================================================

/**
 * Schema for Ideal Customer Profile (ICP) segments.
 * Used by createWorkspace and updateWorkspace tools.
 */
/** Mirrors syntheticProfileExampleValidator; required only for new generation. */
export const syntheticProfileExamplesSchema = z
  .array(
    z.object({
      platform: z.enum(["twitter", "linkedin"]),
      displayName: z.string().min(1).max(80),
      title: z.string().min(1).max(160),
      bio: z.string().min(1).max(300),
    })
  )
  .length(2)
  .describe(
    "Exactly two fictional profiles of this ONE persona: one twitter and one linkedin. Natural first-person social bios, not qualification summaries. No real identities, links, or contact information."
  );

export const icpSchema = z.object({
  title: z.string().describe("ICP segment title"),
  description: z.string().describe("Who this segment is"),
  painPoints: z.array(z.string()).describe("Their pain points"),
  channels: z.array(z.string()).describe("Where to find them"),
  syntheticExamples: syntheticProfileExamplesSchema,
  // Synthetic posts: realistic tweets/posts this ICP would write (stored permanently)
  syntheticPosts: z
    .array(z.string())
    .min(5)
    .max(10)
    .describe(
      "5-10 realistic tweets/posts this ICP would write expressing pain points"
    ),
  // Keywords for qualification evidence search (derived from syntheticPosts)
  qualificationKeywords: z
    .array(z.string().max(40))
    .min(5)
    .max(10)
    .describe(
      "10 short keywords (max 40 chars) for searching prospect's own posts"
    ),
});

export type ICP = z.infer<typeof icpSchema>;
