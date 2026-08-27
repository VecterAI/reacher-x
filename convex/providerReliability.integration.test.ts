/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const requestResult = {
  provider: "socialapi" as const,
  consumer: "provider-reliability-test",
  endpoint: "/test",
  requestCount: 1,
  billableUnits: 1,
  estimatedCostUsd: 0,
  durationMs: 10,
};

describe("provider circuit write contention", () => {
  test("records healthy requests without creating or rewriting shared circuit state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const t = convexTest(schema, modules);

    await t.mutation(internal.providerReliability.recordProviderRequestResult, {
      ...requestResult,
      outcome: "success",
      healthEvidence: true,
    });
    await t.mutation(internal.providerReliability.recordProviderRequestResult, {
      ...requestResult,
      outcome: "success",
      healthEvidence: true,
    });

    const state = await t.run(async (ctx) => ({
      circuits: await ctx.db.query("providerCircuitStates").collect(),
      events: await ctx.db.query("providerRequestEvents").collect(),
    }));
    expect(state.circuits).toHaveLength(0);
    expect(state.events).toHaveLength(2);
  });

  test("writes the circuit row when health evidence closes a degraded state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const t = convexTest(schema, modules);
    const circuitId = await t.run(async (ctx) =>
      ctx.db.insert("providerCircuitStates", {
        provider: "socialapi",
        status: "open",
        reason: "transient",
        errorMessage: "Temporary provider failure",
        consecutiveFailures: 3,
        openedAt: 1_000,
        retryAfterAt: 2_000,
        lastFailureAt: 1_000,
        updatedAt: 1_000,
      })
    );

    await t.mutation(internal.providerReliability.recordProviderRequestResult, {
      ...requestResult,
      outcome: "success",
      healthEvidence: true,
    });

    expect(
      await t.run(async (ctx) => ctx.db.get("providerCircuitStates", circuitId))
    ).toMatchObject({
      status: "closed",
      consecutiveFailures: 0,
      lastSuccessAt: 20_000,
      updatedAt: 20_000,
    });
  });
});
