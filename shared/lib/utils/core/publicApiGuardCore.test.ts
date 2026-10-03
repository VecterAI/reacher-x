import { describe, expect, it } from "vitest";
import { getClientIp, memoizeTtl, rateLimit } from "./publicApiGuardCore";

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://reacherx.com/api/describe-url", { headers });
}

describe("rateLimit", () => {
  it("allows requests up to the limit and reports retry timing after", () => {
    const key = "test:allow:1";
    for (let index = 0; index < 3; index += 1) {
      expect(rateLimit(key, { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
    }
    const blocked = rateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("opens a fresh window once the window has elapsed", async () => {
    const key = "test:window:1";
    const options = { limit: 1, windowMs: 25 };
    expect(rateLimit(key, options).allowed).toBe(true);
    expect(rateLimit(key, options).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(rateLimit(key, options).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const options = { limit: 1, windowMs: 60_000 };
    expect(rateLimit("test:independent:a", options).allowed).toBe(true);
    expect(rateLimit("test:independent:b", options).allowed).toBe(true);
    expect(rateLimit("test:independent:a", options).allowed).toBe(false);
  });
});

describe("getClientIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    expect(
      getClientIp(requestWith({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }))
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip and then a shared bucket", () => {
    expect(getClientIp(requestWith({ "x-real-ip": "198.51.100.9" }))).toBe(
      "198.51.100.9"
    );
    expect(getClientIp(requestWith({}))).toBe("unknown");
  });
});

describe("memoizeTtl", () => {
  it("shares one load between concurrent callers", async () => {
    let loads = 0;
    const load = async () => {
      loads += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `value-${loads}`;
    };
    const [first, second] = await Promise.all([
      memoizeTtl("test:concurrent", 60_000, load),
      memoizeTtl("test:concurrent", 60_000, load),
    ]);
    expect(loads).toBe(1);
    expect(first).toBe("value-1");
    expect(second).toBe("value-1");
  });

  it("reuses the cached result until the TTL expires", async () => {
    let loads = 0;
    const load = async () => {
      loads += 1;
      return `value-${loads}`;
    };
    expect(await memoizeTtl("test:ttl", 20, load)).toBe("value-1");
    expect(await memoizeTtl("test:ttl", 20, load)).toBe("value-1");
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(await memoizeTtl("test:ttl", 20, load)).toBe("value-2");
  });

  it("does not cache rejected loads and clears the in-flight marker", async () => {
    let loads = 0;
    const load = async () => {
      loads += 1;
      if (loads === 1) throw new Error("transient failure");
      return `value-${loads}`;
    };
    await expect(memoizeTtl("test:failure", 60_000, load)).rejects.toThrow(
      "transient failure"
    );
    expect(await memoizeTtl("test:failure", 60_000, load)).toBe("value-2");
  });
});
