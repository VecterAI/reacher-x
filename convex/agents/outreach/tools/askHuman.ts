// convex/agents/outreach/tools/askHuman.ts
// Human-in-the-loop tool - creates notification and returns pending status
// Using createTool pattern following three-layer architecture

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { AskHumanResult } from "../../../lib/outreachCore";

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Ask human for guidance or approval.
 *
 * This tool returns a pending status with the question details.
 * The agent framework and workflow handle:
 * 1. Detecting the pending response
 * 2. Creating a notification for the user
 * 3. Pausing via awaitEvent until human responds
 *
 * Use cases:
 * - Complex decisions requiring user input
 * - Approval before taking destructive actions
 * - Clarification on ambiguous instructions
 * - Content approval before posting
 */
export const askHuman = createTool({
  description:
    "Ask the user for guidance, clarification, or approval. Use this when you need human input to proceed, such as approving a message before posting, clarifying ambiguous requirements, or making a decision that requires user preference. After calling this, the conversation will pause until the user responds.",
  args: z.object({
    question: z
      .string()
      .describe("The question or request for the user. Be clear and specific."),
    context: z
      .string()
      .optional()
      .describe("Additional context to help the user understand the situation"),
    urgency: z
      .enum(["low", "medium", "high"])
      .optional()
      .default("medium")
      .describe(
        "How urgent is this request? High urgency will notify the user immediately."
      ),
    options: z
      .array(z.string())
      .optional()
      .describe("Suggested options for the user to choose from, if applicable"),
  }),
  handler: async (_ctx, args): Promise<AskHumanResult> => {
    // Return pending status with question details
    // The workflow layer detects this and:
    // 1. Creates notification via createHumanNotification
    // 2. Uses awaitEvent to pause until human responds
    // 3. Sends response back to agent as tool result
    return {
      pending: true,
      message: `Waiting for user response to: "${args.question}"`,
      question: args.question,
      context: args.context,
      urgency: args.urgency ?? "medium",
      options: args.options,
    };
  },
});
