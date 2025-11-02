// convex/keywordSuggestionsBattleTested.ts
"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { z } from "zod";
import { logger } from "../shared/lib/logger";
import { validateKeywordWithLlmFilter } from "./lib/keywordValidation";

// Schema for Grok validation output per batch
const BattleBatchSchema = z.object({
  keywords: z
    .array(
      z.object({
        keyword: z.string().min(1).max(100),
        exactMatch: z.boolean(),
        score: z.number().min(0).max(100),
        examples: z.array(z.string()).min(0).max(3).optional(),
      })
    )
    .min(1)
    .max(5),
});

type BattleBatch = z.infer<typeof BattleBatchSchema>;

async function grokLiveSearchBatch(args: {
  apiKey: string;
  model: string; // e.g., "grok-4-fast-reasoning"
  userDescription: string;
  priorSuccesses: string[];
  priorFailures: string[];
  doNotRepeat?: string[]; // normalized set to avoid repeats across attempts
}): Promise<BattleBatch> {
  const { apiKey, model, userDescription, priorSuccesses, priorFailures } =
    args;
  const baseURL = process.env.XAI_BASE_URL || "https://api.x.ai/v1";

  const system = `You are an expert potential customer finding AI agent for ReacherX, a platform that helps anyone find potential customers on social media. Your expertise lies in crafting inventive, emotionally resonant search queries that surface genuine buyer intent on Twitter/X, using creative language to mimic real people's frustrations, humor, and vulnerabilities—while filtering out promotional noise from sellers, affiliates, and spammers. You MUST use your live search to validate each keyword by checking if it yeilds tweets/posts/replies/quotes that are likely to be potential customers.`;

  const doNotRepeatBlock =
    args.doNotRepeat && args.doNotRepeat.length > 0
      ? `\nDO_NOT_REPEAT (normalized): ${Array.from(
          new Set(args.doNotRepeat)
        ).join(", ")}`
      : "";

  const guidance = `TASK: Generate 5 unique creative buyer-intent keywords (2-4 words max) for the user's description. For EACH keyword:
1) Perform LIVE SEARCH on X.
2) Evaluate quality (0-100) based on how many results are potential customers vs. promotions/noise.
3) If exactMatch should be true (precise phrase), ensure the keyword is <= 40 chars.
4) Return JSON ONLY as {"keywords":[{keyword, exactMatch, score, examples: [up to 3 tweet texts]}]}.

Context:
- What user described: ${userDescription}
- What worked: ${priorSuccesses.length > 0 ? priorSuccesses.join(", ") : "(none)"}
- What failed: ${priorFailures.length > 0 ? priorFailures.join(", ") : "(none)"}
${doNotRepeatBlock}

Scoring rubric:
- >=80: strong potential customer; keep.
- <80: weak/noise; don't include in output.
`;

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: guidance },
    ],
    temperature: 0.3,
    // xAI live search
    search_parameters: {
      mode: "on",
      sources: [{ type: "x" }],
      max_search_results: 10,
    },
    response_format: { type: "json_object" },
  } as const;

  // Fetch with retry/backoff for xAI 5xx resilience
  const fetchWithRetry = async (): Promise<Response> => {
    const maxAttempts = 3;
    let attempt = 0;
    let lastErr: unknown;
    while (attempt < maxAttempts) {
      try {
        const res = await fetch(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });
        if (res.ok) return res;
        const txt = await res.text();
        const rayMatch = txt.match(
          /Ray ID:\s*<strong[^>]*>([^<]+)<\/strong>|Ray ID:\s*([A-Za-z0-9\-]+)/i
        );
        const rayId = rayMatch?.[1] || rayMatch?.[2] || undefined;
        // Log and backoff on 5xx
        if (res.status >= 500) {
          console.error(
            JSON.stringify({
              level: "error",
              message: "XAI.Error",
              args: {
                status: res.status,
                statusText: res.statusText,
                rayId,
                snippet: txt.slice(0, 120),
              },
            })
          );
          const backoff = Math.floor(200 + Math.random() * 400) * (attempt + 1);
          await new Promise((r) => setTimeout(r, backoff));
          attempt++;
          continue;
        }
        throw new Error(
          `xAI chat completion failed: ${res.status} ${res.statusText} - ${txt}`
        );
      } catch (e) {
        lastErr = e;
        const backoff = Math.floor(300 + Math.random() * 500) * (attempt + 1);
        await new Promise((r) => setTimeout(r, backoff));
        attempt++;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error("xAI chat completion failed after retries");
  };

  const res = await fetchWithRetry();

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data?.choices?.[0]?.message?.content as string | undefined;
  if (!content || typeof content !== "string") {
    throw new Error("xAI returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(
      `Failed to parse xAI JSON content: ${(e as Error).message}`
    );
  }
  return BattleBatchSchema.parse(parsed);
}

export const generateBattleTestedKeywords = action({
  args: {
    userDescription: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    progressKey: v.optional(v.string()),
  },
  handler: async (ctx, { userDescription, workspaceId, progressKey }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) throw new Error("XAI_API_KEY is not set");

    const model = "grok-4-fast-reasoning";
    const survivors: {
      keyword: string;
      exactMatch: boolean;
      score?: number;
      examplesCount?: number;
    }[] = [];
    const successes: string[] = [];
    const failures: string[] = [];

    const MAX_ATTEMPTS = 5;
    const TARGET = 10;

    // Build do-not-repeat set from server existing unused suggestions (auth only)
    const doNotRepeatSet = new Set<string>();
    if (workspaceId) {
      try {
        const existing = await ctx.runQuery(
          api.keywordSuggestions.getSuggestions,
          {
            workspaceId,
            userDescription,
            limit: 200,
          }
        );
        for (const s of existing || []) {
          const key = `${s.keyword.trim().toLowerCase()}|${s.metadata?.exactMatch ? 1 : 0}`;
          doNotRepeatSet.add(key);
        }
      } catch {}
    }

    for (
      let attempt = 1;
      attempt <= MAX_ATTEMPTS && survivors.length < TARGET;
      attempt++
    ) {
      try {
        logger.info("[BATTLE_TEST] Attempt", {
          attempt,
          successes: successes.length,
          failures: failures.length,
        });
        const batch = await grokLiveSearchBatch({
          apiKey,
          model,
          userDescription,
          priorSuccesses: successes,
          priorFailures: failures,
          doNotRepeat: Array.from(doNotRepeatSet),
        });

        // Mid-run progress bump: keep within 30..59 range while battle-tested generation runs
        if (progressKey) {
          try {
            const attemptProgress = Math.min(
              59,
              30 + Math.floor((attempt / MAX_ATTEMPTS) * 25)
            );
            await ctx.runMutation(api.searchProgress.upsertProgress, {
              keywordKey: progressKey,
              operation: "initial",
              phase: "searching",
              value: attemptProgress,
            });
          } catch {}
        }

        for (const k of batch.keywords) {
          const exactOk = !k.exactMatch || k.keyword.trim().length <= 20;
          if (k.score >= 80 && exactOk) {
            // Keep
            survivors.push({
              keyword: k.keyword.trim(),
              exactMatch: k.exactMatch,
              score: k.score,
              examplesCount: Array.isArray(k.examples) ? k.examples.length : 0,
            });
            successes.push(k.keyword.trim());
          } else {
            failures.push(k.keyword.trim());
          }
          if (survivors.length >= TARGET) break;
        }
      } catch (e) {
        logger.error("[BATTLE_TEST] Batch failed", {
          error: (e as Error).message,
        });
      }
    }

    // Deduplicate by normalized keyword
    const seen = new Set<string>();
    const unique = survivors.filter((s) => {
      const key = `${s.keyword.toLowerCase()}|${s.exactMatch ? 1 : 0}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Validate via live search + non-chunked LLM filter: keep only queries with >=1 kept
    const validated: Array<{
      keyword: string;
      exactMatch: boolean;
      score?: number;
      examplesCount?: number;
      resultCount: number;
    }> = [];
    // Progress hint before filtering phase
    if (progressKey) {
      try {
        await ctx.runMutation(api.searchProgress.upsertProgress, {
          keywordKey: progressKey,
          operation: "initial",
          phase: "filtering",
          value: 75,
        });
      } catch {}
    }

    for (const s of unique) {
      try {
        logger.info("POST_FILTER.Query", {
          requestId: "battle_test",
          keyword: s.keyword,
          exactMatch: s.exactMatch,
        });
        const { kept, originalCount } = await validateKeywordWithLlmFilter(
          ctx,
          s.keyword,
          !!s.exactMatch,
          userDescription
        );
        logger.info("POST_FILTER.Result", {
          requestId: "battle_test",
          keyword: s.keyword,
          kept,
          original: originalCount,
        });
        if (kept >= 1) {
          validated.push({ ...s, resultCount: kept });
        }
      } catch (err) {
        logger.error("POST_FILTER.Error", {
          keyword: s.keyword,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      if (validated.length >= TARGET) break;
    }

    if (progressKey) {
      try {
        await ctx.runMutation(api.searchProgress.upsertProgress, {
          keywordKey: progressKey,
          operation: "initial",
          phase: "finalizing",
          value: 90,
        });
      } catch {}
    }

    return {
      success: true,
      data: validated.slice(0, TARGET),
      metadata: {
        modelUsed: model,
        attempts: Math.min(
          MAX_ATTEMPTS,
          unique.length === 0 ? MAX_ATTEMPTS : Math.ceil(unique.length / 5)
        ),
      },
    };
  },
});
