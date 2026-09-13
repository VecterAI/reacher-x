// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FaqsAccordion } from "../sections/FaqsAccordion";
import { homepageFaqItems } from "@/features/landing/lib/faqs";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

test("FAQ answers expand, switch, and collapse with correct accessible relationships", async () => {
  await act(async () =>
    root.render(<FaqsAccordion items={homepageFaqItems} />)
  );
  const buttons = Array.from(container.querySelectorAll("button"));
  expect(buttons).toHaveLength(homepageFaqItems.length);
  expect(
    buttons.every((button) => button.getAttribute("aria-expanded") === "false")
  ).toBe(true);
  for (const [index, button] of buttons.entries()) {
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(
      button.getAttribute("aria-controls")!
    );
    expect(panel?.textContent).toBe(homepageFaqItems[index].answer);
    expect(panel?.getAttribute("aria-labelledby")).toBe(button.id);
    expect(
      buttons.filter(
        (button) => button.getAttribute("aria-expanded") === "true"
      )
    ).toHaveLength(1);
  }
  await act(async () => buttons.at(-1)!.click());
  expect(
    buttons.every((button) => button.getAttribute("aria-expanded") === "false")
  ).toBe(true);
});
