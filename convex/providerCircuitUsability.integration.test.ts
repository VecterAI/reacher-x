/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import {
  isProviderCircuitOpenError,
  isProviderCircuitStateUsable,
  ProviderCircuitOpenError,
} from "./lib/providerReliability";

const modules = import.meta.glob("./**/*.ts");
const now = Date.UTC(2026, 10, 1, 12);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function createTest() {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  return convexTest(schema, modules);
}

function openCircuitRow(args: {
  provider: "socialapi" | "linkdapi";
  retryAfterAt?: number;
  probeLeaseUntil?: number;
  status?: "open" | "half_open";
}) {
  return {
    provider: args.provider,
    status: args.status ?? ("open" as const),
    reason: "rate_limit" as const,
    consecutiveFailures: 1,
    retryAfterAt: args.retryAfterAt,
    probeLeaseUntil: args.probeLeaseUntil,
    updatedAt: now,
  };
}

describe("isProviderCircuitStateUsable", () => {
  test("treats a missing or closed circuit as usable", () => {
    expect(isProviderCircuitStateUsable(undefined, now)).toBe(true);
    expect(isProviderCircuitStateUsable(null, now)).toBe(true);
    expect(isProviderCircuitStateUsable({ status: "closed" }, now)).toBe(true);
  });

  test("blocks an open circuit whose retry window has not arrived", () => {
    expect(
      isProviderCircuitStateUsable(
        { status: "open", retryAfterAt: now + 1 },
        now
      )
    ).toBe(false);
    expect(isProviderCircuitStateUsable({ status: "open" }, now)).toBe(false);
  });

  test("treats a due probe window as usable so the circuit keeps probing", () => {
    expect(
      isProviderCircuitStateUsable({ status: "open", retryAfterAt: now }, now)
    ).toBe(true);
    expect(
      isProviderCircuitStateUsable(
        { status: "open", retryAfterAt: now - 1 },
        now
      )
    ).toBe(true);
  });

  test("blocks a half-open circuit with an active probe lease", () => {
    expect(
      isProviderCircuitStateUsable(
        { status: "half_open", probeLeaseUntil: now + 1 },
        now
      )
    ).toBe(false);
    expect(isProviderCircuitStateUsable({ status: "half_open" }, now)).toBe(
      false
    );
  });

  test("treats an expired half-open probe lease as usable", () => {
    expect(
      isProviderCircuitStateUsable(
        { status: "half_open", probeLeaseUntil: now - 1 },
        now
      )
    ).toBe(true);
  });
});

describe("isProviderCircuitOpenError", () => {
  test("recognizes the error instance and its serialized name", () => {
    const error = new ProviderCircuitOpenError({
      provider: "linkdapi",
      reason: "rate_limit",
    });
    expect(isProviderCircuitOpenError(error)).toBe(true);
    const serialized = new Error(error.message);
    serialized.name = "ProviderCircuitOpenError";
    expect(isProviderCircuitOpenError(serialized)).toBe(true);
    expect(isProviderCircuitOpenError(new Error("boom"))).toBe(false);
    expect(isProviderCircuitOpenError(undefined)).toBe(false);
  });
});

describe("checkProviderCircuitUsabilityInternal", () => {
  test("reports unusable while the retry window is pending", async () => {
    const t = createTest();
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "providerCircuitStates",
        openCircuitRow({
          provider: "linkdapi",
          retryAfterAt: now + 60_000,
        })
      );
    });
    const result = await t.query(
      internal.providerReliability.checkProviderCircuitUsabilityInternal,
      { provider: "linkdapi" }
    );
    expect(result.usable).toBe(false);
    expect(result.reason).toBe("rate_limit");
  });

  test("reports usable once the probe window is due", async () => {
    const t = createTest();
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "providerCircuitStates",
        openCircuitRow({
          provider: "linkdapi",
          retryAfterAt: now - 60_000,
        })
      );
    });
    const result = await t.query(
      internal.providerReliability.checkProviderCircuitUsabilityInternal,
      { provider: "linkdapi" }
    );
    expect(result.usable).toBe(true);
  });

  test("reports usable for providers without circuit state", async () => {
    const t = createTest();
    const result = await t.query(
      internal.providerReliability.checkProviderCircuitUsabilityInternal,
      { provider: "socialapi" }
    );
    expect(result.usable).toBe(true);
  });
});

describe("provider search actions fail fast on open circuits", () => {
  test("LinkedIn post search returns a failure instead of throwing", async () => {
    const t = createTest();
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "providerCircuitStates",
        openCircuitRow({
          provider: "linkdapi",
          retryAfterAt: now + 60_000,
        })
      );
    });
    const result = await t.action(
      internal.integrations.linkedin.searchPosts.searchInternal,
      { query: "ads agency" }
    );
    expect(result.success).toBe(false);
    expect(result.posts).toEqual([]);
    expect(result.error).toContain("temporarily unavailable");
  });

  test("LinkedIn people search returns a failure instead of throwing", async () => {
    const t = createTest();
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "providerCircuitStates",
        openCircuitRow({
          provider: "linkdapi",
          retryAfterAt: now + 60_000,
        })
      );
    });
    const result = await t.action(
      internal.integrations.linkedin.searchPeople.searchInternal,
      { query: "ads agency", searchMode: "keyword" }
    );
    expect(result.success).toBe(false);
    expect(result.people).toEqual([]);
    expect(result.error).toContain("temporarily unavailable");
  });

  test("X post search returns a failure instead of throwing", async () => {
    vi.stubEnv("SOCIALAPI_API_KEY", "test-key");
    const t = createTest();
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "providerCircuitStates",
        openCircuitRow({
          provider: "socialapi",
          retryAfterAt: now + 60_000,
        })
      );
    });
    const result = await t.action(
      internal.integrations.twitter.searchPosts.searchInternal,
      { query: "paid advertising" }
    );
    expect(result.success).toBe(false);
    expect(result.posts).toEqual([]);
    expect(result.error).toContain("temporarily unavailable");
  });
});
