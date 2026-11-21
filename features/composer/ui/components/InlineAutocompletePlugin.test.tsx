// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type LexicalEditor,
} from "lexical";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { INLINE_SUGGESTION_ATTRIBUTE } from "@/features/composer/lib/inlineSuggestionAnchor";
import { InlineAutocompletePlugin } from "./InlineAutocompletePlugin";

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
let editor: LexicalEditor;

function CaptureEditor() {
  const [lexicalEditor] = useLexicalComposerContext();
  editor = lexicalEditor;
  return null;
}

async function mount() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <LexicalComposer
        initialConfig={{
          namespace: "inline-autocomplete-plugin-test",
          onError: (error) => {
            throw error;
          },
        }}
      >
        <RichTextPlugin
          contentEditable={<ContentEditable />}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <InlineAutocompletePlugin
          inlineAutocompleteContext={{
            surfaceLabel: "test",
            platform: "twitter",
          }}
        />
        <CaptureEditor />
      </LexicalComposer>
    );
  });
  editor.getRootElement()!.focus();
}

/** Replaces the content and puts the caret at the end, like typing it. */
async function type(text: string) {
  await act(async () => {
    editor.update(
      () => {
        const node = $createTextNode(text);
        $getRoot().clear().append($createParagraphNode().append(node));
        node.selectEnd();
      },
      { discrete: true }
    );
  });
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function editorText() {
  return editor.getEditorState().read(() => $getRoot().getTextContent());
}

function ghostElement() {
  return editor
    .getRootElement()!
    .querySelector<HTMLElement>(`[${INLINE_SUGGESTION_ATTRIBUTE}]`);
}

/** Dispatches a keydown and lets Lexical's queued update commit. */
async function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  await act(async () => {
    editor.getRootElement()!.dispatchEvent(event);
  });
  return event;
}

async function showGhost(text = "Thanks for the", suggestion = "quick reply") {
  mocks.fetchSuggestion.mockResolvedValueOnce({
    suggestion,
    latencyMs: 90,
    model: "test-model",
    styleProfileApplied: false,
  });
  await type(text);
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

test("shows the ghost in the text flow at the caret, marked for assistive tech", async () => {
  await showGhost();

  expect(mocks.fetchSuggestion).toHaveBeenCalledTimes(1);
  expect(mocks.fetchSuggestion.mock.calls[0][0]).toMatchObject({
    surface: "composer",
    surfaceLabel: "test",
    beforeCursor: "Thanks for the",
    afterCursor: "",
  });

  const ghost = ghostElement();
  expect(ghost?.textContent).toBe("Thanks for the");
  expect(ghost?.getAttribute(INLINE_SUGGESTION_ATTRIBUTE)).toBe(" quick reply");
  expect(editor.getRootElement()!.getAttribute("aria-autocomplete")).toBe(
    "inline"
  );
  expect(host.querySelector('[role="status"]')?.textContent).toBe(
    "Suggestion: quick reply. Press Tab to accept."
  );
  // Not part of the document the user is writing.
  expect(editorText()).toBe("Thanks for the");
  expect(mocks.capture).toHaveBeenCalledWith(
    "inline_autocomplete_shown",
    expect.objectContaining({ surface: "composer", surfaceLabel: "test" })
  );
});

test("typing a prefix of the suggestion trims the ghost with no new request", async () => {
  await showGhost();
  await type("Thanks for the qu");

  expect(ghostElement()?.getAttribute(INLINE_SUGGESTION_ATTRIBUTE)).toBe(
    "ick reply"
  );
  await wait(1000);
  expect(mocks.fetchSuggestion).toHaveBeenCalledTimes(1);
});

test("Tab inserts the whole suggestion", async () => {
  await showGhost();
  const event = await press("Tab");

  expect(event.defaultPrevented).toBe(true);
  expect(editorText()).toBe("Thanks for the quick reply");
  expect(ghostElement()).toBeNull();
  expect(editor.getRootElement()!.hasAttribute("aria-autocomplete")).toBe(
    false
  );
  expect(mocks.capture).toHaveBeenCalledWith(
    "inline_autocomplete_accepted",
    expect.anything()
  );
});

test("Ctrl+Right accepts one word and keeps the rest as ghost", async () => {
  await showGhost("Thanks for the", "quick reply today");
  const event = await press("ArrowRight", { ctrlKey: true });

  expect(event.defaultPrevented).toBe(true);
  expect(editorText()).toBe("Thanks for the quick");
  expect(ghostElement()?.getAttribute(INLINE_SUGGESTION_ATTRIBUTE)).toBe(
    " reply today"
  );
  expect(mocks.capture).toHaveBeenCalledWith(
    "inline_autocomplete_partial_accept",
    expect.objectContaining({ acceptedLength: 6 })
  );
});

test("plain Right and Ctrl+Right without a ghost are left to the editor", async () => {
  await type("Thanks for the");
  expect((await press("ArrowRight", { ctrlKey: true })).defaultPrevented).toBe(
    false
  );

  await showGhost("Thanks for the note", "here");
  expect((await press("ArrowRight")).defaultPrevented).toBe(false);
});

test("scrolling and resizing keep the ghost", async () => {
  await showGhost();
  await act(async () => {
    editor.getRootElement()!.dispatchEvent(new Event("scroll"));
    document.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
  });

  expect(ghostElement()?.getAttribute(INLINE_SUGGESTION_ATTRIBUTE)).toBe(
    " quick reply"
  );
  expect(mocks.capture).not.toHaveBeenCalledWith(
    "inline_autocomplete_dismissed",
    expect.anything()
  );
});

test("Escape dismisses", async () => {
  await showGhost();
  const event = await press("Escape");

  expect(event.defaultPrevented).toBe(true);
  expect(ghostElement()).toBeNull();
  expect(mocks.capture).toHaveBeenCalledWith(
    "inline_autocomplete_dismissed",
    expect.objectContaining({ reason: "escape" })
  );
});

test("a divergent edit dismisses without a server cancel", async () => {
  await showGhost();
  await type("Thanks for the x");

  expect(ghostElement()).toBeNull();
  expect(mocks.capture).toHaveBeenCalledWith(
    "inline_autocomplete_dismissed",
    expect.objectContaining({ reason: "input_changed" })
  );
  expect(mocks.cancel).not.toHaveBeenCalled();
});

test("blur dismisses", async () => {
  await showGhost();
  await act(async () => {
    editor.getRootElement()!.dispatchEvent(new FocusEvent("blur"));
  });

  expect(ghostElement()).toBeNull();
  expect(mocks.capture).toHaveBeenCalledWith(
    "inline_autocomplete_dismissed",
    expect.objectContaining({ reason: "blur" })
  );
});

test("IME composition suppresses requests", async () => {
  await act(async () => {
    editor.getRootElement()!.dispatchEvent(new Event("compositionstart"));
  });
  await type("Thanks for the");
  await wait(1000);
  expect(mocks.fetchSuggestion).not.toHaveBeenCalled();
});
