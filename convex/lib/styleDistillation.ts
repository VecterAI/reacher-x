"use node";

// convex/lib/styleDistillation.ts
// LLM-based writing style analysis: extracts identity (to mirror) and craft (to elevate)
// from user's organic posts and edit diffs. Follows the learningCore.ts pattern.

import { z } from "zod";
import { robustGenerateObject } from "./ai";

// ============================================================================
// Schema
// ============================================================================

const writingStyleProfileSchema = z.object({
  identity: z.object({
    vocabulary: z.object({
      signatureWords: z
        .array(z.string())
        .max(15)
        .describe("Words/phrases this person uses repeatedly"),
      avoidedWords: z
        .array(z.string())
        .max(10)
        .describe("Words they never use despite being common"),
      jargonLevel: z.enum(["minimal", "moderate", "heavy"]),
      formality: z.enum(["very_casual", "casual", "neutral", "formal"]),
    }),
    personality: z.object({
      humor: z.enum([
        "none",
        "dry",
        "playful",
        "sarcastic",
        "self_deprecating",
      ]),
      enthusiasm: z.enum(["understated", "moderate", "high"]),
      directness: z.enum(["diplomatic", "balanced", "blunt"]),
      emojiUsage: z.enum(["never", "rare", "moderate", "frequent"]),
    }),
    sentenceStructure: z.object({
      averageLength: z.enum(["short", "medium", "long"]),
      usesFragments: z.boolean(),
      usesQuestions: z.boolean(),
    }),
    openingPatterns: z
      .array(z.string())
      .max(5)
      .describe("How they typically start posts"),
    closingPatterns: z
      .array(z.string())
      .max(5)
      .describe("How they typically end posts"),
  }),
  craft: z.object({
    strengths: z
      .array(z.string())
      .max(5)
      .describe("What they do well in writing"),
    weaknesses: z
      .array(z.string())
      .max(5)
      .describe("What could be improved for outreach"),
    elevationNotes: z
      .string()
      .max(500)
      .describe(
        "How to write in their voice but with better outreach craft"
      ),
  }),
  editPreferences: z
    .object({
      consistentChanges: z
        .array(z.string())
        .max(10)
        .describe("Patterns in how they edit agent drafts"),
      rejectedPatterns: z
        .array(z.string())
        .max(5)
        .describe("Things the agent writes that they always remove"),
      addedPatterns: z
        .array(z.string())
        .max(5)
        .describe("Things they consistently add"),
    })
    .optional(),
  profileSummary: z
    .string()
    .min(50)
    .max(800)
    .describe(
      "Natural language instructions for an AI agent to write in this person's voice"
    ),
  representativeSamples: z
    .array(z.string())
    .max(5)
    .describe("3-5 actual posts that best showcase this person's voice"),
  confidence: z.number().min(0).max(1),
});

export type WritingStyleProfile = z.infer<typeof writingStyleProfileSchema>;

// ============================================================================
// Types
// ============================================================================

export interface StyleDistillationResult {
  profile: WritingStyleProfile;
  telemetry: {
    operation: string;
    model: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    request?: unknown;
    response?: unknown;
    providerMetadata?: unknown;
  };
}

// ============================================================================
// System Prompt
// ============================================================================

const STYLE_ANALYSIS_SYSTEM_PROMPT = `You are a writing style analyst for an AI prospecting system.

Analyze the user's posts and edit behavior to build a style profile that an AI agent will use to write outreach messages in this person's authentic voice.

CORE PRINCIPLE: "Elevate, don't imitate"
- MIRROR their identity: vocabulary, personality, humor, sentence structure, tone.
- ELEVATE their craft: keep their voice but improve clarity and persuasion.
  If they're sloppy, tighten the copy while keeping their personality.
  If they use filler words, keep the energy but remove the filler.
- NEVER make them sound like a generic LinkedIn post or marketing template.

Analysis rules:
1. Look for CONSISTENT patterns across multiple posts. Ignore one-off anomalies.
2. Weight recent posts higher than older ones.
3. Edit diffs are the HIGHEST signal — the user is directly showing you what they want vs. don't want.
4. Separate identity traits (who they are) from craft traits (how well they write).
5. The profileSummary must be written AS INSTRUCTIONS to an AI agent, not as a description of the user.
   Example: "Write in short punchy sentences. Use 'tbh' and 'ngl' naturally. Never use exclamation marks. Ask direct questions. Drop articles when it feels natural. Keep replies under 3 sentences."
6. representativeSamples: pick 3-5 posts that best showcase this person's voice. Copy them exactly.
7. If edit diffs are provided, editPreferences is REQUIRED — extract what the user consistently changes.`;

// ============================================================================
// Distillation Function
// ============================================================================

/**
 * Distill a writing style profile from user's posts and edit behavior.
 * Uses structured output generation with the same pattern as learningCore.ts.
 */
export async function distillWritingStyleProfile(args: {
  tweets: Array<{ text: string; isReply: boolean; postedAt: number }>;
  editDiffs?: Array<{ original: string; edited: string; source: string }>;
  existingProfile?: string;
}): Promise<StyleDistillationResult> {
  // Sort tweets by recency (most recent first)
  const sortedTweets = [...args.tweets].sort(
    (a, b) => b.postedAt - a.postedAt
  );

  // Build the prompt
  const tweetSection = sortedTweets
    .map((t, i) => {
      const type = t.isReply ? "[Reply]" : "[Original]";
      return `${i + 1}. ${type} ${t.text}`;
    })
    .join("\n");

  const editSection =
    args.editDiffs && args.editDiffs.length > 0
      ? args.editDiffs
          .map(
            (d, i) =>
              `Edit ${i + 1} (${d.source}):\n  BEFORE: ${d.original}\n  AFTER:  ${d.edited}`
          )
          .join("\n\n")
      : "No edit diffs available yet.";

  const existingSection = args.existingProfile
    ? `\nPrevious profile (refine, don't start from scratch):\n${args.existingProfile}`
    : "";

  const prompt = `Analyze these ${sortedTweets.length} posts from the user (most recent first):

${tweetSection}

---

Edit diffs (user corrections to agent-generated drafts):

${editSection}
${existingSection}

Build a comprehensive writing style profile. The profileSummary should be actionable instructions that an AI agent can follow to write exactly like this person.`;

  const { object, model, usage, providerMetadata } =
    await robustGenerateObject({
      operation: "distillWritingStyle",
      schema: writingStyleProfileSchema,
      system: STYLE_ANALYSIS_SYSTEM_PROMPT,
      prompt,
      temperature: 0.2,
      maxRetries: 2,
    });

  return {
    profile: object,
    telemetry: {
      operation: "distillWritingStyle",
      model,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      },
      providerMetadata,
    },
  };
}
