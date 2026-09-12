// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/shared/hooks", async () => ({
  usePreferredShellQueryArgs: () => ({}),
  useReportingQueryNow: (await import("@/shared/hooks/useReportingQueryNow"))
    .useReportingQueryNow,
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
function render() {
  act(() =>
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
  });
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
  test("returning to a window within the cycle does not restart the usage query", () => {
    render();
    const output = container.firstChild;
    vi.setSystemTime(now + 60_000);
    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(new Set(state.clocks)).toEqual(new Set([now]));
    expect(result().usage).toEqual(usage);
    expect(container.firstChild).toBe(output);
  });
  test("hourly clock refreshes keep resolved usage visible until the next result", () => {
    render();
    state.data = undefined;
    act(() => vi.advanceTimersByTime(3_601_000));
    expect(new Set(state.clocks).size).toBe(2);
    expect(result().usage).toEqual(usage);
    state.data = { ...usage, used: 42, limitReached: false };
    render();
    expect(result().usage?.used).toBe(42);
  });
  test("a missed cycle boundary refreshes on return without hiding the notice", () => {
    render();
    state.data = undefined;
    vi.setSystemTime(usage.cycleEnd + 1);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(state.clocks.at(-1)).toBe(usage.cycleEnd + 1);
    expect(result().usage).toEqual(usage);
    state.data = {
      ...usage,
      used: 0,
      limitReached: false,
      cycleEnd: usage.cycleEnd + 86_400_000,
      noticeKey: "cycle-b",
    };
    render();
    expect(result().usage?.limitReached).toBe(false);
    expect(result().usage?.noticeKey).toBe("cycle-b");
  });
  test("the cycle timer refreshes even when the window stays open", () => {
    state.data = { ...usage, cycleEnd: now + 5_000 };
    render();
    act(() => vi.advanceTimersByTime(5_001));
    expect(state.clocks.at(-1)).toBe(now + 5_001);
  });
  test("switching workspaces never displays the previous workspace's usage", () => {
    render();
    state.workspaceId = "workspace-b";
    state.data = undefined;
    render();
    expect(result().usage).toBeNull();
    state.workspaceId = "workspace-a";
    render();
    expect(result().usage).toBeNull();
  });
  test.each(["denied", "error", "sign-out", "setup"])(
    "%s clears retained usage",
    (reason) => {
      render();
      if (reason === "denied") state.data = null;
      if (reason === "error") {
        state.data = undefined;
        state.error = true;
      }
      if (reason === "sign-out") state.authenticated = false;
      if (reason === "setup") state.pathname = "/agent/setup";
      render();
      expect(result().usage).toBeNull();
      if (reason === "error") expect(result().unavailable).toBe(true);
    }
  );
});
