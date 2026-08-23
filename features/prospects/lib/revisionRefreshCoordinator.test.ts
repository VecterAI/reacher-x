import { describe, expect, it, vi } from "vitest";
import { createRevisionRefreshCoordinator } from "./revisionRefreshCoordinator";

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("revision refresh coordinator", () => {
  it("coalesces revisions received during an active refresh", async () => {
    let resolveFirst: (() => void) | undefined;
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValue(undefined);
    const coordinator = createRevisionRefreshCoordinator({
      refresh,
      canRefresh: () => true,
      getRetryAt: () => undefined,
    });

    coordinator.request("revision-1");
    coordinator.request("revision-2");
    coordinator.request("revision-3");
    expect(refresh).toHaveBeenCalledTimes(1);

    resolveFirst?.();
    await flushPromises();
    expect(refresh).toHaveBeenCalledTimes(2);

    coordinator.request("revision-3");
    await flushPromises();
    expect(refresh).toHaveBeenCalledTimes(2);
    coordinator.dispose();
  });

  it("waits until retryAt and schedules only one trailing retry", async () => {
    vi.useFakeTimers();
    let now = 1_000;
    const error = new Error("429 Too Many Requests");
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined);
    const coordinator = createRevisionRefreshCoordinator({
      refresh,
      canRefresh: () => true,
      getRetryAt: (caught) => (caught === error ? 2_000 : undefined),
      now: () => now,
    });

    coordinator.request("revision-1");
    await flushPromises();
    coordinator.request("revision-2");
    coordinator.request("revision-3");
    expect(refresh).toHaveBeenCalledTimes(1);

    now = 1_999;
    await vi.advanceTimersByTimeAsync(999);
    expect(refresh).toHaveBeenCalledTimes(1);

    now = 2_000;
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    coordinator.dispose();
    vi.useRealTimers();
  });

  it("queues until refresh capability becomes available", async () => {
    let available = false;
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const coordinator = createRevisionRefreshCoordinator({
      refresh,
      canRefresh: () => available,
      getRetryAt: () => undefined,
    });

    coordinator.request("revision-1");
    await flushPromises();
    expect(refresh).not.toHaveBeenCalled();

    available = true;
    coordinator.request("revision-2");
    await flushPromises();
    expect(refresh).toHaveBeenCalledTimes(1);
    coordinator.dispose();
  });
});
