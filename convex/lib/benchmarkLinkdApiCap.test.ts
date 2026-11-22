import { describe, expect, test } from "vitest";
import type { ActionCtx } from "../_generated/server";
import {
  isKeywordPostSearchCapRefusal,
  KEYWORD_POST_SEARCH_PURPOSE,
  keywordPostSearchCapMessage,
  resolveKeywordPostSearchLimit,
} from "./benchmarkLinkdApiCap";
import { acquireLinkdApiBudget } from "./linkdapiBudget";
import { isProviderCircuitOpenError } from "./providerReliability";

describe("benchmark keyword post-search cap", () => {
  test("unset means no cap, as in production", () => {
    for (const value of [undefined, "", "  "])
      expect(resolveKeywordPostSearchLimit(value)).toEqual({
        limit: null,
        source: "default",
        error: null,
      });
  });

  test("a positive whole number sets the cap", () => {
    expect(resolveKeywordPostSearchLimit(" 100\n")).toEqual({
      limit: 100,
      source: "benchmark",
      error: null,
    });
  });

  test("invalid values never cap and report an error", () => {
    for (const value of ["0", "-5", "1.5", "1e2", "abc", "100000000"]) {
      const resolved = resolveKeywordPostSearchLimit(value);
      expect(resolved.limit).toBeNull();
      expect(resolved.source).toBe("default");
      expect(resolved.error).not.toBeNull();
    }
  });

  test("a refused reservation surfaces as an open-circuit refusal", async () => {
    const ctx = {
      runMutation: async () => ({ allowed: true }),
      runAction: async () => ({
        waitMs: 0,
        spacingMs: 0,
        targetRequestsPerMinute: 0,
        benchmarkCapRefused: 100,
      }),
    } as unknown as ActionCtx;
    const refusal = await acquireLinkdApiBudget(ctx, "linkedin.test").then(
      () => null,
      (error: unknown) => error
    );
    expect(isProviderCircuitOpenError(refusal)).toBe(true);
    expect(isKeywordPostSearchCapRefusal(refusal)).toBe(true);
  });

  test("only the keyword post search sends a purpose to the reservation", async () => {
    const sent: unknown[] = [];
    const ctx = {
      runMutation: async () => ({ allowed: true }),
      runAction: async (_ref: unknown, args: unknown) => {
        sent.push(args);
        return {
          waitMs: 0,
          spacingMs: 0,
          targetRequestsPerMinute: 0,
          benchmarkCapRefused: null,
        };
      },
    } as unknown as ActionCtx;
    await acquireLinkdApiBudget(ctx, "linkedin.getProfile");
    await acquireLinkdApiBudget(
      ctx,
      "linkedin.searchUserPosts",
      undefined,
      KEYWORD_POST_SEARCH_PURPOSE
    );
    expect(sent).toEqual([
      { consumer: "linkedin.getProfile" },
      {
        consumer: "linkedin.searchUserPosts",
        purpose: KEYWORD_POST_SEARCH_PURPOSE,
      },
    ]);
  });

  test("a refusal is recognized after crossing an action boundary", () => {
    // Convex rethrows a nested action's error as a plain Error with its message.
    expect(
      isKeywordPostSearchCapRefusal(
        new Error(`Uncaught Error: ${keywordPostSearchCapMessage(50)}`)
      )
    ).toBe(true);
    expect(isKeywordPostSearchCapRefusal(new Error("LinkdAPI 503"))).toBe(
      false
    );
    expect(isKeywordPostSearchCapRefusal("not an error")).toBe(false);
  });

  test("an allowed reservation is returned unchanged", async () => {
    const reservation = {
      waitMs: 0,
      spacingMs: 0,
      targetRequestsPerMinute: 0,
      benchmarkCapRefused: null,
    };
    const ctx = {
      runMutation: async () => ({ allowed: true }),
      runAction: async () => reservation,
    } as unknown as ActionCtx;
    await expect(acquireLinkdApiBudget(ctx, "linkedin.test")).resolves.toBe(
      reservation
    );
  });
});
