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
export const icpSchema = z.object({
  title: z.string().describe("ICP segment title"),
  description: z.string().describe("Who this segment is"),
  painPoints: z.array(z.string()).describe("Their pain points"),
  channels: z.array(z.string()).describe("Where to find them"),
});

export type ICP = z.infer<typeof icpSchema>;
