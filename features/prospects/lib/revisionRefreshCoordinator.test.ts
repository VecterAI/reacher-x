import { describe, expect, it, vi } from "vitest";
import {
  createRevisionRefreshCoordinator,
  shouldRefreshXChatConversationRevision,
} from "./revisionRefreshCoordinator";

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

  it("does not retry an ordinary failure for the same revision", async () => {
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error("provider unavailable"));
    const coordinator = createRevisionRefreshCoordinator({
      refresh,
      canRefresh: () => true,
      getRetryAt: () => undefined,
    });

    coordinator.request("revision-1");
    await flushPromises();
    coordinator.request("revision-1");
    await flushPromises();
    expect(refresh).toHaveBeenCalledTimes(1);

    coordinator.request("revision-2");
    await flushPromises();
    expect(refresh).toHaveBeenCalledTimes(2);
    coordinator.dispose();
  });
});

describe("XChat conversation revision coverage", () => {
  it("skips an initial revision already represented by the decrypted page", () => {
    expect(
      shouldRefreshXChatConversationRevision({
        current: {
          revision: "100:message-1:100",
          latestMessageId: "message-1",
        },
        latestMessageCovered: true,
      })
    ).toBe(false);
  });

  it("fetches an initial revision missing from the decrypted page", () => {
    expect(
      shouldRefreshXChatConversationRevision({
        current: {
          revision: "100:message-1:100",
          latestMessageId: "message-1",
        },
        latestMessageCovered: false,
      })
    ).toBe(true);
  });

  it("fetches a newer revision when the latest message ID is unchanged", () => {
    expect(
      shouldRefreshXChatConversationRevision({
        previous: {
          revision: "100:message-1:100",
          latestMessageId: "message-1",
        },
        current: {
          revision: "200:message-1:100",
          latestMessageId: "message-1",
        },
        latestMessageCovered: true,
      })
    ).toBe(true);
  });

  it("skips a newer-message revision already applied from realtime delivery", () => {
    expect(
      shouldRefreshXChatConversationRevision({
        previous: {
          revision: "100:message-1:100",
          latestMessageId: "message-1",
        },
        current: {
          revision: "200:message-2:200",
          latestMessageId: "message-2",
        },
        latestMessageCovered: true,
      })
    ).toBe(false);
  });

  it("fetches a newer-message revision missing from realtime delivery", () => {
    expect(
      shouldRefreshXChatConversationRevision({
        previous: {
          revision: "100:message-1:100",
          latestMessageId: "message-1",
        },
        current: {
          revision: "200:message-2:200",
          latestMessageId: "message-2",
        },
        latestMessageCovered: false,
      })
    ).toBe(true);
  });

  it("does nothing for an unchanged or missing revision", () => {
    const previous = {
      revision: "100:message-1:100",
      latestMessageId: "message-1",
    };
    expect(
      shouldRefreshXChatConversationRevision({
        previous,
        current: previous,
        latestMessageCovered: false,
      })
    ).toBe(false);
    expect(
      shouldRefreshXChatConversationRevision({
        previous,
        current: { revision: null, latestMessageId: null },
        latestMessageCovered: false,
      })
    ).toBe(false);
  });
});
