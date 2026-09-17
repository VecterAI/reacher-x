// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { AnimationActivityProvider } from "@/shared/contexts/AnimationActivityProvider";
import { AsciiSpinnerText } from "./AsciiSpinnerText";
import { AnimatedElapsedTimer } from "./AnimatedElapsedTimer";
vi.mock("./AnimatedNumber", () => ({
  default: ({ value }: { value: number }) => String(value),
}));

test("inactive surfaces stop decorative timers and resume them; the normal app keeps its default behavior", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.setSystemTime(200000);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const contents = () =>
    h(
      "div",
      null,
      h(AsciiSpinnerText),
      h(AnimatedElapsedTimer, { startedAt: 100000 })
    );
  const surface = (active: boolean) =>
    h(AnimationActivityProvider, { active, children: contents() });
  try {
    await act(async () => root.render(surface(false)));
    expect(vi.getTimerCount()).toBe(0);
    const initial = host.textContent;
    await act(async () => vi.advanceTimersByTime(2000));
    expect(host.textContent).toBe(initial);
    await act(async () => root.render(surface(true)));
    expect(vi.getTimerCount()).toBe(2);
    await act(async () => vi.advanceTimersByTime(2100));
    expect(host.textContent).not.toBe(initial);
    await act(async () => root.render(surface(false)));
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => root.render(contents()));
    expect(vi.getTimerCount()).toBe(2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
