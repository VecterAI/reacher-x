// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SetupOnboardingInlineCard } from "./SetupOnboardingInlineCard";

vi.mock("@/shared/ui/components/AnimatedNumber", () => ({
  default: ({
    value,
    format,
  }: {
    value: number;
    format?: { minimumIntegerDigits?: number };
  }) => String(value).padStart(format?.minimumIntegerDigits ?? 1, "0"),
}));

test("generation timer uses persisted time, survives remounts, resets on retry and disappears on completion/error", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  const host = document.createElement("div");
  document.body.append(host);
  let root = createRoot(host);
  const props: ComponentProps<typeof SetupOnboardingInlineCard> = {
    useCaseKey: "recruiting",
    title: "Describe who you need",
    stepNumber: 1,
    stepTotal: 3,
    inputPhase: "generating_icps",
    generatedProfiles: [],
    generationStartedAt: 75000,
  };
  const render = (patch: Partial<typeof props> = {}) =>
    act(async () =>
      root.render(<SetupOnboardingInlineCard {...props} {...patch} />)
    );
  try {
    await render();
    const footer = () => host.querySelector("footer")!;
    expect(footer().textContent).toContain("Working...");
    expect(footer().lastElementChild?.textContent).toBe("0:25");
    await act(async () => vi.advanceTimersByTime(35000));
    expect(footer().lastElementChild?.textContent).toBe("1:00");
    await act(async () => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    root = createRoot(host);
    await render();
    expect(footer().lastElementChild?.textContent).toBe("1:00");
    await render({ generationStartedAt: 135000 });
    expect(footer().lastElementChild?.textContent).toBe("0:00");
    await render({ generationStartedAt: 140000 });
    expect(footer().lastElementChild?.textContent).toBe("0:00");
    await render({ generationStartedAt: null });
    expect(footer().textContent).not.toMatch(/\d+:\d\d/);
    await render({ inputPhase: "awaiting_icp_approval" });
    expect(footer().textContent).toContain("ready to review");
    expect(footer().textContent).not.toMatch(/\d+:\d\d/);
    expect(vi.getTimerCount()).toBe(0);
    const retry = vi.fn();
    await render({ errorMessage: "Generation failed", onRetry: retry });
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(footer().textContent).not.toMatch(/\d+:\d\d/);
    await act(async () => host.querySelector("button")!.click());
    expect(retry).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
