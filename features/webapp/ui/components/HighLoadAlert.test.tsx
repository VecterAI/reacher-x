// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HighLoadAlert } from "./HighLoadAlert";
import { HIGH_LOAD_NOTICE_COPY } from "@/shared/ui/components/HighLoadNotice";

const state = vi.hoisted(() => ({
  authenticated: true,
  connected: true,
  pathname: "/",
  params: "",
  workspaceId: "workspace-a",
  mode: "running",
  context: "workspace",
  shellError: false,
  queryError: false,
  data: null as
    | null
    | undefined
    | { state: "queued" | "slow"; validUntil: number },
  scopes: [] as unknown[],
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated }),
  useConvexConnectionState: () => ({ isWebSocketConnected: state.connected }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.params),
}));
vi.mock("@/shared/hooks/usePreferredShellQueryArgs", () => ({
  usePreferredShellQueryArgs: () => ({}),
}));
vi.mock("@/shared/hooks/useQueryWithStatus", () => ({
  useQueryWithStatus: (
    query: Parameters<typeof getFunctionName>[0],
    args: unknown
  ) => {
    if (args === "skip") return { data: undefined, isError: false };
    if (getFunctionName(query) === "shell:getAppShellState")
      return {
        isError: state.shellError,
        data: {
          activeContextType: state.context,
          workspaceSystemStatus: {
            workspaceId: state.workspaceId,
            mode: state.mode,
          },
          activeSetupSession: { threadId: "active-draft" },
        },
      };
    state.scopes.push(args);
    return { data: state.data, isError: state.queryError };
  },
}));

const now = Date.UTC(2026, 8, 18);
let root: Root;
let host: HTMLDivElement;
async function render() {
  await act(async () => root.render(<HighLoadAlert />));
}
async function tick(ms = 5_000) {
  await act(async () => vi.advanceTimersByTime(ms));
}
function banner() {
  return host.querySelector("[data-high-load-notice]");
}
function queued(validUntil = now + 60_000) {
  state.data = { state: "queued", validUntil };
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(state, {
    authenticated: true,
    connected: true,
    pathname: "/",
    params: "",
    workspaceId: "workspace-a",
    mode: "running",
    context: "workspace",
    shellError: false,
    queryError: false,
    data: null,
    scopes: [],
  });
  vi.useFakeTimers();
  vi.setSystemTime(now);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("HighLoadAlert lifecycle", () => {
  test("browser offline hides the notice before the WebSocket detects the loss", async () => {
    queued();
    await render();
    await tick();
    expect(banner()).not.toBeNull();
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await act(async () => window.dispatchEvent(new Event("offline")));
    expect(banner()).toBeNull();
    online.mockReturnValue(true);
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(banner()).toBeNull();
    await tick();
    expect(banner()).not.toBeNull();
  });
  test("normal/loading states show nothing; short capacity waits never flash", async () => {
    await render();
    await tick();
    expect(banner()).toBeNull();
    state.data = undefined;
    await render();
    expect(banner()).toBeNull();
    queued();
    await render();
    await tick(4_999);
    expect(banner()).toBeNull();
    state.data = null;
    await render();
    await tick(1);
    expect(banner()).toBeNull();
    await tick(1_000);
    expect(banner()).toBeNull();
  });

  test("shows unchanged copy after five seconds, updates without restarting, then clears", async () => {
    queued();
    await render();
    await tick(4_999);
    expect(banner()).toBeNull();
    await tick(1);
    expect(banner()?.textContent).toContain(HIGH_LOAD_NOTICE_COPY.queued);
    state.data = { state: "slow", validUntil: now + 60_000 };
    await render();
    expect(banner()?.textContent).toContain(HIGH_LOAD_NOTICE_COPY.slow);
    expect(banner()?.getAttribute("role")).toBe("status");
    expect(host.querySelector("a")?.getAttribute("href")).toBe(
      "https://x.com/ReacherXfounder"
    );
    state.data = null;
    await render();
    await tick(1_000);
    expect(banner()).toBeNull();
  });

  test("dismissal survives queued/slow changes, resets for a new pressure episode", async () => {
    queued();
    await render();
    await tick();
    await act(async () =>
      (
        host.querySelector(
          '[aria-label="Dismiss high load notice"]'
        ) as HTMLButtonElement
      ).click()
    );
    expect(banner()).toBeNull();
    state.data = { state: "slow", validUntil: now + 60_000 };
    await render();
    await tick();
    expect(banner()).toBeNull();
    state.data = null;
    await render();
    await tick(1_000);
    queued();
    await render();
    await tick();
    expect(banner()).not.toBeNull();
  });

  test("brief slot handoffs do not starve the show timer or flicker a visible notice", async () => {
    queued();
    await render();
    for (let i = 0; i < 5; i++) {
      await tick(900);
      state.data = null;
      await render();
      await tick(100);
      queued();
      await render();
    }
    expect(banner()).not.toBeNull();
    state.data = null;
    await render();
    await tick(999);
    expect(banner()).not.toBeNull();
    await tick(1);
    expect(banner()).toBeNull();
  });

  test("dismissal survives offline/reconnect and brief slot handoffs", async () => {
    queued();
    await render();
    await tick();
    await act(async () =>
      (
        host.querySelector(
          '[aria-label="Dismiss high load notice"]'
        ) as HTMLButtonElement
      ).click()
    );
    state.connected = false;
    await render();
    state.connected = true;
    await render();
    await tick();
    expect(banner()).toBeNull();
    state.data = null;
    await render();
    await tick(100);
    queued();
    await render();
    await tick();
    expect(banner()).toBeNull();
  });

  test("workspace switches reset timers and dismissal; unrelated workspaces stay clear", async () => {
    queued();
    await render();
    await tick();
    state.workspaceId = "workspace-b";
    state.data = null;
    await render();
    expect(banner()).toBeNull();
    queued();
    await render();
    expect(banner()).toBeNull();
    await tick();
    expect(banner()).not.toBeNull();
    expect(state.scopes.at(-1)).toEqual({
      scope: { kind: "workspace", workspaceId: "workspace-b" },
    });
  });

  test.each(["paused", "attention", "degraded"])(
    "does not reassure a workspace in %s mode",
    async (mode) => {
      queued();
      state.mode = mode;
      await render();
      await tick();
      expect(banner()).toBeNull();
      expect(state.scopes).toHaveLength(0);
    }
  );

  test("sign-out, query failures, shell failures, disconnect and downtime hide stale reassurance", async () => {
    for (const reason of [
      "authenticated",
      "connected",
      "queryError",
      "shellError",
    ] as const) {
      queued();
      await render();
      await tick();
      expect(banner()).not.toBeNull();
      state[reason] = reason.endsWith("Error");
      await render();
      expect(banner()).toBeNull();
      state[reason] = !reason.endsWith("Error");
    }
    vi.stubEnv("NEXT_PUBLIC_BACKEND_STATUS_BANNER", "true");
    await render();
    await tick();
    expect(banner()).toBeNull();
  });

  test("expires without a database write; a renewed lease restores visibility", async () => {
    queued(now + 6_000);
    await render();
    await tick();
    expect(banner()).not.toBeNull();
    await tick(1_000);
    expect(banner()).toBeNull();
    queued(now + 60_000);
    await render();
    expect(banner()).not.toBeNull();
  });

  test("an already-expired lease never shows; foregrounding rechecks after device sleep", async () => {
    queued(now - 1);
    await render();
    await tick();
    expect(banner()).toBeNull();
    queued(now + 60_000);
    await render();
    expect(banner()).not.toBeNull();
    vi.setSystemTime(now + 120_000);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(banner()).toBeNull();
  });

  test("setup uses the URL thread before shell fallback, without requiring a workspace", async () => {
    state.pathname = "/agent/setup";
    state.context = "setup_session";
    state.params = "threadId=older-draft";
    queued();
    await render();
    await tick();
    expect(banner()).not.toBeNull();
    expect(state.scopes.at(-1)).toEqual({
      scope: { kind: "setup", threadId: "older-draft" },
    });
    state.params = "";
    await render();
    expect(banner()).toBeNull();
    expect(state.scopes.at(-1)).toEqual({
      scope: { kind: "setup", threadId: "active-draft" },
    });
  });
});
