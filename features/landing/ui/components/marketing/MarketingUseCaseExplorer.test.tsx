// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import { MarketingUseCaseExplorer } from "./MarketingUseCaseExplorer";

vi.mock("./MarketingDemo", () => ({
  MarketingDemo: ({ scenario }: { scenario: string }) => (
    <div data-demo={scenario} />
  ),
}));
let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<MarketingUseCaseExplorer />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

test("each audience opens its own demo and destination without keeping hidden players mounted", async () => {
  const tabs = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  );
  expect(tabs).toHaveLength(8);
  for (const [index, tab] of tabs.entries()) {
    await act(async () =>
      tab.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0 })
      )
    );
    const selected = MARKETING_USE_CASES[index];
    expect(tab.getAttribute("aria-selected")).toBe("true");
    const panel = document.getElementById(tab.getAttribute("aria-controls")!)!;
    expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
    expect(panel.querySelector("a")?.getAttribute("href")).toBe(selected.href);
    expect(container.querySelectorAll("[data-demo]")).toHaveLength(1);
    expect(panel.querySelector("[data-demo]")?.getAttribute("data-demo")).toBe(
      selected.guide
    );
  }
});

test("keyboard activation changes the selected audience", async () => {
  const tabs = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  );
  await act(async () => tabs[3].focus());
  await act(async () =>
    tabs[3].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    )
  );
  expect(tabs[3].getAttribute("aria-selected")).toBe("true");
  expect(tabs[0].getAttribute("aria-selected")).toBe("false");
  expect(container.querySelectorAll("[data-demo]")).toHaveLength(1);
});
