// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PromptInput, PromptInputTextarea } from "./PromptInput";

const mocks = vi.hoisted(() => ({
  fetchSuggestion: vi.fn(),
  cancel: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    autocompleteControl: {
      isEnabled: "isEnabled",
      cancelThreadHelperRequests: "cancelThreadHelperRequests",
    },
    autocomplete: { getInlineSuggestion: "getInlineSuggestion" },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: () => true,
  useAction: () => mocks.fetchSuggestion,
  useMutation: () => mocks.cancel,
}));

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mocks.capture }),
}));

let host: HTMLDivElement;
let root: Root;

const textarea = () => host.querySelector("textarea")!;
const mirror = () =>
  host.querySelector<HTMLDivElement>('div[aria-hidden="true"]');

async function mount(options: { readOnly?: boolean } = {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <PromptInput>
        <PromptInputTextarea
          inlineAutocompleteContext={{ surfaceLabel: "prompt-test" }}
          readOnly={options.readOnly}
        />
      </PromptInput>
    );
  });
  await act(async () => {
    textarea().focus();
  });
}

/** Sets the value like typing does and puts the caret at `caret`. */
async function type(value: string, caret = value.length) {
  await act(async () => {
    const el = textarea();
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )!.set!.call(el, value);
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("select", { bubbles: true }));
  });
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  await act(async () => {
    textarea().dispatchEvent(event);
  });
  return event;
}

async function showGhost(text: string, suggestion: string, caret?: number) {
  mocks.fetchSuggestion.mockResolvedValueOnce({
    suggestion,
    latencyMs: 90,
    model: "test-model",
    styleProfileApplied: false,
  });
  await type(text, caret);
  await wait(400);
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  mocks.fetchSuggestion.mockReset();
  mocks.cancel.mockReset().mockResolvedValue(undefined);
  mocks.capture.mockReset();
  await mount();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("renders the ghost in a wrapping mirror, in order with the text after the caret", async () => {
  await showGhost("Thanks for the\nsecond line", "quick reply", 14);

  expect(mocks.fetchSuggestion.mock.calls[0][0]).toMatchObject({
    surface: "prompt_input",
    beforeCursor: "Thanks for the",
    afterCursor: "\nsecond line",
  });
  const ghostMirror = mirror();
  expect(ghostMirror).not.toBeNull();
  expect(ghostMirror!.style.whiteSpace).toBe("pre-wrap");
  expect(ghostMirror!.textContent).toBe(
    "Thanks for the quick reply\nsecond line​"
  );
  expect(ghostMirror!.querySelector("span")?.textContent).toBe(" quick reply");
  // The textarea hides its own glyphs with -webkit-text-fill-color while the
  // mirror shows; happy-dom drops that property, so it is not asserted here.
  expect(textarea().getAttribute("aria-autocomplete")).toBe("inline");
  expect(host.querySelector('[role="status"]')?.textContent).toBe(
    "Suggestion: quick reply. Press Tab to accept."
  );
});

test("prefix typing trims the ghost; Tab accepts the rest", async () => {
  await showGhost("Thanks for the", "quick reply");
  await type("Thanks for the qu");

  expect(mirror()?.querySelector("span")?.textContent).toBe("ick reply");
  await wait(1000);
  expect(mocks.fetchSuggestion).toHaveBeenCalledTimes(1);

  const event = await press("Tab");
  expect(event.defaultPrevented).toBe(true);
  expect(textarea().value).toBe("Thanks for the quick reply");
  expect(mirror()).toBeNull();
});

test("Ctrl+Right accepts one word", async () => {
  await showGhost("Thanks for the", "quick reply today");
  const event = await press("ArrowRight", { ctrlKey: true });

  expect(event.defaultPrevented).toBe(true);
  expect(textarea().value).toBe("Thanks for the quick");
  expect(mocks.capture).toHaveBeenCalledWith(
    "inline_autocomplete_partial_accept",
    expect.objectContaining({ surface: "prompt_input" })
  );
});

test("scrolling keeps the ghost; Escape and blur dismiss", async () => {
  await showGhost("Thanks for the", "quick reply");
  await act(async () => {
    textarea().dispatchEvent(new Event("scroll"));
  });
  expect(mirror()).not.toBeNull();

  await press("Escape");
  expect(mirror()).toBeNull();
  expect(mocks.capture).toHaveBeenLastCalledWith(
    "inline_autocomplete_dismissed",
    expect.objectContaining({ reason: "escape" })
  );

  await showGhost("Thanks for the note", "here");
  expect(mirror()).not.toBeNull();
  await act(async () => {
    textarea().blur();
  });
  expect(mirror()).toBeNull();
  expect(mocks.capture).toHaveBeenLastCalledWith(
    "inline_autocomplete_dismissed",
    expect.objectContaining({ reason: "blur" })
  );
});

test("aria-autocomplete is set before any suggestion and kept after it", async () => {
  expect(textarea().getAttribute("aria-autocomplete")).toBe("inline");
  await showGhost("Thanks for the", "quick reply");
  await press("Escape");
  expect(textarea().getAttribute("aria-autocomplete")).toBe("inline");
});

test("Escape while a request runs cancels it and leaves the key to the caller", async () => {
  let answer!: (value: unknown) => void;
  mocks.fetchSuggestion.mockReturnValueOnce(
    new Promise((resolve) => {
      answer = resolve;
    })
  );
  await type("Thanks for the");
  await wait(400);

  const event = await press("Escape");
  expect(event.defaultPrevented).toBe(false);

  await act(async () => {
    answer({
      suggestion: "quick reply",
      latencyMs: 90,
      model: "test-model",
      styleProfileApplied: false,
    });
  });
  expect(mirror()).toBeNull();
});

test("a read-only field never requests or accepts", async () => {
  act(() => root.unmount());
  host.remove();
  await mount({ readOnly: true });

  expect(textarea().hasAttribute("aria-autocomplete")).toBe(false);
  await type("Thanks for the");
  await wait(1000);
  expect(mocks.fetchSuggestion).not.toHaveBeenCalled();
  expect((await press("ArrowRight", { ctrlKey: true })).defaultPrevented).toBe(
    false
  );
});

test("the mirror re-measures when the textarea is resized without a render", async () => {
  const observers: { callback: () => void; disconnected: boolean }[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      entry = { callback: () => {}, disconnected: false };
      constructor(callback: () => void) {
        this.entry.callback = callback;
        observers.push(this.entry);
      }
      observe() {}
      disconnect() {
        this.entry.disconnected = true;
      }
    }
  );
  await showGhost("Thanks for the", "quick reply");
  const live = observers.find((entry) => !entry.disconnected);
  expect(live).toBeDefined();

  Object.defineProperty(textarea(), "offsetWidth", {
    value: 517,
    configurable: true,
  });
  await act(async () => {
    live!.callback();
  });
  expect(mirror()?.style.width).toBe("517px");

  await press("Escape");
  expect(observers.every((entry) => entry.disconnected)).toBe(true);
});
