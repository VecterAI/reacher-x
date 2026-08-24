import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./mapWithConcurrency";

describe("mapWithConcurrency", () => {
  it("bounds active work and preserves input order", async () => {
    let active = 0;
    let maximumActive = 0;
    const resolvers: Array<() => void> = [];
    const resultPromise = mapWithConcurrency([1, 2, 3, 4], 2, async (item) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise<void>((resolve) => resolvers.push(resolve));
      active -= 1;
      return item * 2;
    });

    await Promise.resolve();
    expect(active).toBe(2);
    resolvers.shift()?.();
    resolvers.shift()?.();
    await Promise.resolve();
    await Promise.resolve();
    resolvers.shift()?.();
    resolvers.shift()?.();

    await expect(resultPromise).resolves.toEqual([2, 4, 6, 8]);
    expect(maximumActive).toBe(2);
  });

  it("rejects invalid concurrency", async () => {
    await expect(
      mapWithConcurrency([1], 0, async (item) => item)
    ).rejects.toThrow("positive integer");
  });
});
