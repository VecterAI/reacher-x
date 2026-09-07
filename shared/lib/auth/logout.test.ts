// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { clearBrowserData } = vi.hoisted(() => ({
  clearBrowserData: vi.fn(async () => undefined),
}));

vi.mock("@/features/agent/lib/xChatBrowserSession", () => ({
  clearXChatBrowserData: clearBrowserData,
}));

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  clearBrowserData.mockClear();
  // Load Sonner before the minimal document stub; no stylesheet is needed.
  await import("sonner");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("browser logout integration", () => {
  test("a stalled POST replaces loading with retry and pagehide clears the new deadline", async () => {
    const requestSubmit = vi.fn();
    const addEventListener = vi.fn();
    vi.stubGlobal("window", { addEventListener, setTimeout });
    vi.stubGlobal("document", {
      createElement: () => ({
        checkValidity: () => true,
        requestSubmit,
        remove: vi.fn(),
      }),
      body: { append: vi.fn() },
    });
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    const { logout } = await import("./logout");
    const { toast } = await import("sonner");
    await logout();
    vi.advanceTimersByTime(750);
    expect(toast.getToasts()).toEqual([
      expect.objectContaining({ type: "loading", title: "Logging out…" }),
    ]);
    vi.advanceTimersByTime(14_250);
    expect(toast.getToasts()).toEqual([
      expect.objectContaining({
        type: "error",
        title: "Couldn't log out. Please try again.",
        action: expect.objectContaining({ label: "Try again" }),
      }),
    ]);
    await logout();
    expect(requestSubmit).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(750);
    expect(toast.getToasts()).toEqual([
      expect.objectContaining({ type: "loading", action: undefined }),
    ]);
    addEventListener.mock.calls[0][1]();
    vi.advanceTimersByTime(30_000);
    expect(toast.getToasts()).toHaveLength(0);
  });

  test("submits a hidden POST after cleanup and resets on pagehide", async () => {
    const form = {
      action: "",
      method: "",
      hidden: false,
      checkValidity: () => true,
      noValidate: false,
      requestSubmit: vi.fn(() => {
        expect(clearBrowserData).toHaveBeenCalledOnce();
      }),
      remove: vi.fn(),
    };
    const addEventListener = vi.fn();
    const append = vi.fn();
    vi.stubGlobal("window", { addEventListener, setTimeout });
    vi.stubGlobal("document", { createElement: () => form, body: { append } });
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    const { logout } = await import("./logout");
    const { toast } = await import("sonner");
    await logout();
    expect(form).toMatchObject({
      action: "/logout/complete",
      method: "post",
      hidden: true,
    });
    expect(append).toHaveBeenCalledWith(form);
    expect(form.requestSubmit).toHaveBeenCalledOnce();
    const reset = addEventListener.mock.calls[0][1];
    reset();
    vi.advanceTimersByTime(750);
    expect(toast.getToasts()).toHaveLength(0);
    await logout();
    expect(form.requestSubmit).toHaveBeenCalledTimes(2);
  });

  test("Sonner keeps the error visible and removes its retry action when loading again", async () => {
    const requestSubmit = vi.fn().mockImplementationOnce(() => {
      throw new Error("submission blocked");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("window", { addEventListener: vi.fn(), setTimeout });
    vi.stubGlobal("document", {
      createElement: () => ({
        checkValidity: () => true,
        requestSubmit,
        remove: vi.fn(),
      }),
      body: { append: vi.fn() },
    });
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    const { logout } = await import("./logout");
    const { toast } = await import("sonner");
    await logout();
    expect(toast.getToasts()).toEqual([
      expect.objectContaining({
        type: "error",
        title: "Couldn't log out. Please try again.",
        action: expect.objectContaining({ label: "Try again" }),
      }),
    ]);
    await logout();
    vi.advanceTimersByTime(750);
    expect(toast.getToasts()).toEqual([
      expect.objectContaining({
        type: "loading",
        title: "Logging out…",
        action: undefined,
      }),
    ]);
    expect(requestSubmit).toHaveBeenCalledTimes(2);
  });
});
