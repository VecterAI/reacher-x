// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import type { Id } from "@/convex/_generated/dataModel";
import {
  WorkspacePlanUsageProvider,
  useWorkspacePlanUsage,
  type WorkspacePlanUsage,
} from "./WorkspacePlanUsageProvider";

const state = vi.hoisted(() => ({
  authenticated: true,
  workspaceId: "workspace-a" as string | null,
  pathname: "/",
  data: undefined as WorkspacePlanUsage | null | undefined,
  error: false,
  clocks: [] as number[],
  serverNow: null as number | null,
  getServerTime: vi.fn<() => Promise<number>>(),
}));
vi.mock("convex/react", () => ({
  useAction: () => state.getServerTime,
  useConvexAuth: () => ({ isAuthenticated: state.authenticated }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/shared/hooks", async () => ({
  usePreferredShellQueryArgs: () => ({}),
  useQueryWithStatus: (
    query: Parameters<typeof getFunctionName>[0],
    args: "skip" | { nowMs: number }
  ) => {
    if (args === "skip")
      return { data: undefined, isPending: true, isError: false };
    if (getFunctionName(query) === "shell:getAppShellState") {
      return {
        data: {
          activeContextType: "workspace",
          workspaceSystemStatus: { workspaceId: state.workspaceId },
        },
        isError: false,
      };
    }
    state.clocks.push(args.nowMs);
    return {
      data: state.data,
      isPending: state.data === undefined,
      isError: state.error,
    };
  },
}));

const now = Date.UTC(2026, 8, 12, 13);
const usage: WorkspacePlanUsage = {
  workspaceId: "workspace-a" as Id<"workspaces">,
  workspaceName: "Creators",
  entityPlural: "Creators",
  discoveryVerb: "finding",
  tier: "hobby",
  used: 100,
  limit: 100,
  cycleEnd: now + 86_400_000,
  noticeKey: "cycle-a",
  noticeDismissed: false,
  limitReached: true,
};
let root: Root;
let container: HTMLDivElement;
function Probe() {
  const value = useWorkspacePlanUsage();
  return <output>{JSON.stringify(value)}</output>;
}
async function render() {
  await act(async () =>
    root.render(
      <WorkspacePlanUsageProvider>
        <Probe />
      </WorkspacePlanUsageProvider>
    )
  );
}
function result() {
  return JSON.parse(container.textContent || "null") as {
    usage: WorkspacePlanUsage | null;
    available: boolean;
    unavailable: boolean;
  };
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  Object.assign(state, {
    authenticated: true,
    workspaceId: "workspace-a",
    pathname: "/",
    data: usage,
    error: false,
    clocks: [],
    serverNow: null,
  });
  state.getServerTime.mockReset();
  state.getServerTime.mockImplementation(
    async () => state.serverNow ?? getCurrentUTCTimestamp()
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("workspace usage refresh stability", () => {
  test.each(["signed-out", "setup", "no-workspace"])(
    "%s never requests server time",
    async (reason) => {
      if (reason === "signed-out") state.authenticated = false;
      if (reason === "setup") state.pathname = "/agent/setup";
      if (reason === "no-workspace") state.workspaceId = null;
      await render();
      await act(async () => {
        window.dispatchEvent(new Event("focus"));
        window.dispatchEvent(new Event("online"));
        document.dispatchEvent(new Event("visibilitychange"));
        vi.advanceTimersByTime(3_600_000);
      });
      expect(state.getServerTime).not.toHaveBeenCalled();
      expect(state.clocks).toHaveLength(0);
    }
  );
  test("disabling cancels refreshes and re-enabling waits for a fresh clock", async () => {
    await render();
    state.authenticated = false;
    await render();
    const calls = state.getServerTime.mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(3_600_000);
    });
    expect(state.getServerTime).toHaveBeenCalledTimes(calls);
    let resolveClock!: (value: number) => void;
    state.getServerTime.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveClock = resolve;
        })
    );
    state.authenticated = true;
    await render();
    expect(result().usage).toBeNull();
    await act(async () => resolveClock(now + 3_600_000));
    expect(state.clocks.at(-1)).toBe(now + 3_600_000);
  });
  test.each([-31, 31])(
    "a device clock skewed by %i days never selects the usage cycle",
    async (days) => {
      state.serverNow = now;
      vi.setSystemTime(now + days * 86_400_000);
      await render();
      expect(new Set(state.clocks)).toEqual(new Set([now]));
      expect(result().usage).toEqual(usage);
    }
  );
  test("usage waits for server time instead of falling back to the device clock", async () => {
    let resolveClock!: (value: number) => void;
    state.getServerTime.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClock = resolve;
        })
    );
    await render();
    expect(state.clocks).toHaveLength(0);
    expect(result().usage).toBeNull();
    await act(async () => resolveClock(now));
    expect(state.clocks.at(-1)).toBe(now);
  });
  test("a failed time sync is unavailable and retries without inventing usage", async () => {
    state.getServerTime
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("still offline"));
    await render();
    expect(result()).toMatchObject({ usage: null, unavailable: true });
    expect(state.clocks).toHaveLength(0);
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(result()).toMatchObject({ usage: null, unavailable: true });
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(result()).toMatchObject({ usage, unavailable: false });
  });
  test("a slow, superseded sync cannot replace a newer server timestamp", async () => {
    let resolveOld!: (value: number) => void;
    state.getServerTime.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    );
    await render();
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(state.clocks.at(-1)).toBe(now);
    await act(async () => resolveOld(now - 86_400_000));
    expect(state.clocks.at(-1)).toBe(now);
  });
  test("cycle refresh timing is independent of a changed device wall clock", async () => {
    state.serverNow = now;
    state.data = { ...usage, cycleEnd: now + 5_000 };
    vi.setSystemTime(now + 31 * 86_400_000);
    await render();
    const calls = state.getServerTime.mock.calls.length;
    vi.setSystemTime(now - 31 * 86_400_000);
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(state.getServerTime).toHaveBeenCalledTimes(calls);
    state.serverNow = now + 5_001;
    await act(async () => vi.advanceTimersByTime(1));
    expect(state.clocks.at(-1)).toBe(now + 5_001);
  });
  test("returning to a window re-syncs server time without unmounting usage", async () => {
    await render();
    const output = container.firstChild;
    vi.setSystemTime(now + 60_000);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(new Set(state.clocks)).toEqual(new Set([now, now + 60_000]));
    expect(result().usage).toEqual(usage);
    expect(container.firstChild).toBe(output);
  });
  test("hourly clock refreshes keep resolved usage visible until the next result", async () => {
    await render();
    state.data = undefined;
    await act(async () => vi.advanceTimersByTime(3_601_000));
    expect(new Set(state.clocks).size).toBe(2);
    expect(result().usage).toEqual(usage);
    state.data = { ...usage, used: 42, limitReached: false };
    await render();
    expect(result().usage?.used).toBe(42);
  });
  test("a missed cycle boundary refreshes on return without hiding the notice", async () => {
    await render();
    state.data = undefined;
    vi.setSystemTime(usage.cycleEnd + 1);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(state.clocks.at(-1)).toBe(usage.cycleEnd + 1);
    expect(result().usage).toEqual(usage);
    state.data = {
      ...usage,
      used: 0,
      limitReached: false,
      cycleEnd: usage.cycleEnd + 86_400_000,
      noticeKey: "cycle-b",
    };
    await render();
    expect(result().usage?.limitReached).toBe(false);
    expect(result().usage?.noticeKey).toBe("cycle-b");
  });
  test("the cycle timer refreshes even when the window stays open", async () => {
    state.data = { ...usage, cycleEnd: now + 5_000 };
    await render();
    await act(async () => vi.advanceTimersByTime(5_001));
    expect(state.clocks.at(-1)).toBe(now + 5_001);
  });
  test("switching workspaces never displays the previous workspace's usage", async () => {
    await render();
    state.workspaceId = "workspace-b";
    state.data = undefined;
    await render();
    expect(result().usage).toBeNull();
    state.workspaceId = "workspace-a";
    await render();
    expect(result().usage).toBeNull();
  });
  test.each(["denied", "error", "sign-out", "setup"])(
    "%s clears retained usage",
    async (reason) => {
      await render();
      if (reason === "denied") state.data = null;
      if (reason === "error") {
        state.data = undefined;
        state.error = true;
      }
      if (reason === "sign-out") state.authenticated = false;
      if (reason === "setup") state.pathname = "/agent/setup";
      await render();
      expect(result().usage).toBeNull();
      if (reason === "error") expect(result().unavailable).toBe(true);
    }
  );
});
