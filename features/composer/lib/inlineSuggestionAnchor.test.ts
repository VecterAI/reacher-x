// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  type LexicalEditor,
  type TextNode,
} from "lexical";
import {
  applyInlineSuggestionDecoration,
  getInlineSuggestionAnchorElement,
  INLINE_SUGGESTION_ATTRIBUTE,
  readCaretTextFromDom,
} from "@/features/composer/lib/inlineSuggestionAnchor";

let cleanup: (() => void)[] = [];

afterEach(() => {
  for (const fn of cleanup) fn();
  cleanup = [];
  document.body.innerHTML = "";
});

function mountEditor(): LexicalEditor {
  const root = document.createElement("div");
  root.contentEditable = "true";
  document.body.appendChild(root);
  const editor = createEditor({
    namespace: "inline-suggestion-anchor-test",
    onError: (error) => {
      throw error;
    },
  });
  editor.setRootElement(root);
  cleanup.push(() => editor.setRootElement(null));
  return editor;
}

/** Builds one paragraph from `parts` and puts the caret where `select` says. */
function setContent(
  editor: LexicalEditor,
  parts: (string | "<br>")[],
  select: (texts: TextNode[]) => void
) {
  editor.update(
    () => {
      const paragraph = $createParagraphNode();
      const texts: TextNode[] = [];
      for (const part of parts) {
        if (part === "<br>") {
          paragraph.append($createLineBreakNode());
        } else {
          const text = $createTextNode(part);
          texts.push(text);
          paragraph.append(text);
        }
      }
      $getRoot().clear().append(paragraph);
      select(texts);
    },
    { discrete: true }
  );
}

describe("Lexical ghost anchor", () => {
  test("anchors to the text node that ends at the caret", () => {
    const editor = mountEditor();
    setContent(editor, ["Thanks for the"], ([text]) => text.select(14, 14));

    const anchor = getInlineSuggestionAnchorElement(editor);
    expect(anchor?.textContent).toBe("Thanks for the");
    expect(editor.getRootElement()?.contains(anchor ?? null)).toBe(true);
  });

  test("anchors to the paragraph when the caret is after its last child", () => {
    const editor = mountEditor();
    setContent(editor, ["Thanks for the"], () => {
      const paragraph = $getRoot().getFirstChildOrThrow<any>();
      paragraph.select(1, 1);
    });

    const anchor = getInlineSuggestionAnchorElement(editor);
    expect(anchor?.tagName).toBe("P");
  });

  test("no anchor when text follows the caret inside the same node", () => {
    const editor = mountEditor();
    setContent(editor, ["Thanks for the reply"], ([text]) =>
      text.select(10, 10)
    );
    expect(getInlineSuggestionAnchorElement(editor)).toBeNull();
  });

  test("no anchor for a range selection", () => {
    const editor = mountEditor();
    setContent(editor, ["Thanks for the"], ([text]) => text.select(0, 6));
    expect(getInlineSuggestionAnchorElement(editor)).toBeNull();
  });

  test("no anchor on an empty paragraph or after a trailing line break", () => {
    const editor = mountEditor();
    setContent(editor, [], () => {
      $getRoot().getFirstChildOrThrow<any>().select(0, 0);
    });
    expect(getInlineSuggestionAnchorElement(editor)).toBeNull();

    setContent(editor, ["Thanks", "<br>"], () => {
      $getRoot().getFirstChildOrThrow<any>().select(2, 2);
    });
    expect(getInlineSuggestionAnchorElement(editor)).toBeNull();
  });

  test("the ghost lives in a DOM attribute, never in the editor state", () => {
    const editor = mountEditor();
    setContent(editor, ["Thanks for the"], ([text]) => text.select(14, 14));
    const anchor = getInlineSuggestionAnchorElement(editor);

    const decorated = applyInlineSuggestionDecoration({
      previous: null,
      target: anchor,
      ghostText: " quick reply",
    });
    expect(decorated).toBe(anchor);
    expect(anchor?.getAttribute(INLINE_SUGGESTION_ATTRIBUTE)).toBe(
      " quick reply"
    );

    const { text, json } = editor.getEditorState().read(() => ({
      text: $getRoot().getTextContent(),
      json: JSON.stringify(editor.getEditorState().toJSON()),
    }));
    expect(text).toBe("Thanks for the");
    expect(json).not.toContain("quick reply");
    expect(editor.getRootElement()?.textContent).toBe("Thanks for the");
  });
});

describe("applyInlineSuggestionDecoration", () => {
  test("moves the attribute to the new anchor and clears it", () => {
    const first = document.createElement("span");
    const second = document.createElement("span");

    let decorated = applyInlineSuggestionDecoration({
      previous: null,
      target: first,
      ghostText: " quick",
    });
    decorated = applyInlineSuggestionDecoration({
      previous: decorated,
      target: second,
      ghostText: "uick",
    });
    expect(first.hasAttribute(INLINE_SUGGESTION_ATTRIBUTE)).toBe(false);
    expect(second.getAttribute(INLINE_SUGGESTION_ATTRIBUTE)).toBe("uick");

    decorated = applyInlineSuggestionDecoration({
      previous: decorated,
      target: second,
      ghostText: "",
    });
    expect(decorated).toBeNull();
    expect(second.hasAttribute(INLINE_SUGGESTION_ATTRIBUTE)).toBe(false);
  });
});

describe("readCaretTextFromDom", () => {
  test("splits the visible text at a collapsed caret", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p><span>Hi @Sam</span><span> thanks</span></p>";
    document.body.appendChild(root);
    const textNode = root.querySelectorAll("span")[1].firstChild!;

    const selection = document.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 3);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    expect(readCaretTextFromDom(root)).toEqual({
      beforeCursor: "Hi @Sam th",
      afterCursor: "anks",
    });
  });

  test("null when the caret is outside the editor or a range is selected", () => {
    const root = document.createElement("div");
    root.textContent = "Thanks for the";
    const outside = document.createElement("div");
    outside.textContent = "elsewhere";
    document.body.append(root, outside);
    const selection = document.getSelection()!;

    const range = document.createRange();
    range.setStart(outside.firstChild!, 2);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(readCaretTextFromDom(root)).toBeNull();

    const expanded = document.createRange();
    expanded.setStart(root.firstChild!, 0);
    expanded.setEnd(root.firstChild!, 6);
    selection.removeAllRanges();
    selection.addRange(expanded);
    expect(readCaretTextFromDom(root)).toBeNull();
  });
});
