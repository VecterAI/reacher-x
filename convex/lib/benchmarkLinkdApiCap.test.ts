import { describe, expect, test } from "vitest";
import type { ActionCtx } from "../_generated/server";
import { resolveLinkdApiCycleLimit } from "./benchmarkLinkdApiCap";
import { acquireLinkdApiBudget } from "./linkdapiBudget";
import { isProviderCircuitOpenError } from "./providerReliability";

describe("benchmark LinkedIn cycle cap", () => {
  test("unset means no cap, as in production", () => {
    for (const value of [undefined, "", "  "])
      expect(resolveLinkdApiCycleLimit(value)).toEqual({
        limit: null,
        source: "default",
        error: null,
      });
  });

  test("a positive whole number sets the cap", () => {
    expect(resolveLinkdApiCycleLimit(" 100\n")).toEqual({
      limit: 100,
      source: "benchmark",
      error: null,
    });
  });

  test("invalid values never cap and report an error", () => {
    for (const value of ["0", "-5", "1.5", "1e2", "abc", "100000000"]) {
      const resolved = resolveLinkdApiCycleLimit(value);
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
    expect((refusal as Error).message).toMatch(/Benchmark LinkedIn cap/);
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
