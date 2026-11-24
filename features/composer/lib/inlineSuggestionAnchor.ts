import {
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  type LexicalEditor,
  type NodeKey,
} from "lexical";

/**
 * Attribute that carries the ghost text. A global `::after` rule renders it
 * (see `app/globals.css`), so the suggestion sits in the text flow right
 * after the caret: it wraps with the line, scrolls with the text and never
 * enters the editor state, the clipboard or the serialized draft.
 *
 * Lexical's DOM mutation observer watches child lists and character data,
 * not attributes, so setting it on a Lexical-managed node is safe.
 */
export const INLINE_SUGGESTION_ATTRIBUTE = "data-inline-suggestion";

/**
 * Key of the node whose DOM element ends exactly at the caret, or `null` when
 * the caret is somewhere an `::after` ghost would render in the wrong place
 * (mid-word, before other text in the same node, an empty line).
 *
 * Must run inside `editor.read()` / `editorState.read()`.
 */
export function $getInlineSuggestionAnchorKey(): NodeKey | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }

  const { anchor } = selection;
  const node = anchor.getNode();

  if ($isTextNode(node)) {
    return anchor.offset === node.getTextContentSize() ? node.getKey() : null;
  }

  if ($isElementNode(node)) {
    const childrenSize = node.getChildrenSize();
    if (childrenSize === 0 || anchor.offset !== childrenSize) {
      return null;
    }
    // After a trailing line break the caret sits on a new, empty line, but an
    // `::after` on the element would render after Lexical's filler <br>.
    if ($isLineBreakNode(node.getLastChild())) {
      return null;
    }
    return node.getKey();
  }

  return null;
}

/** DOM element the ghost attaches to for the current selection. */
export function getInlineSuggestionAnchorElement(
  editor: LexicalEditor
): HTMLElement | null {
  const key = editor.getEditorState().read($getInlineSuggestionAnchorKey);
  return key ? editor.getElementByKey(key) : null;
}

/**
 * Text before and after the caret from the DOM selection, matching what the
 * user sees (mention chips included). `null` unless the caret is collapsed
 * inside `rootElement`.
 */
export function readCaretTextFromDom(rootElement: HTMLElement): {
  beforeCursor: string;
  afterCursor: string;
} | null {
  const selection = rootElement.ownerDocument.getSelection();
  if (
    !selection ||
    selection.rangeCount === 0 ||
    !selection.isCollapsed ||
    !rootElement.contains(selection.anchorNode)
  ) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const beforeRange = range.cloneRange();
  beforeRange.selectNodeContents(rootElement);
  beforeRange.setEnd(range.endContainer, range.endOffset);

  const afterRange = range.cloneRange();
  afterRange.selectNodeContents(rootElement);
  afterRange.setStart(range.endContainer, range.endOffset);

  return {
    beforeCursor: beforeRange.toString(),
    afterCursor: afterRange.toString(),
  };
}

/**
 * Moves the ghost attribute to `target` (or removes it). Returns the element
 * that now carries it so the caller can clear it next time.
 */
export function applyInlineSuggestionDecoration(args: {
  previous: HTMLElement | null;
  target: HTMLElement | null;
  ghostText: string;
}): HTMLElement | null {
  const { previous, target, ghostText } = args;
  const next = ghostText && target ? target : null;

  if (previous && previous !== next) {
    previous.removeAttribute(INLINE_SUGGESTION_ATTRIBUTE);
  }
  if (next && next.getAttribute(INLINE_SUGGESTION_ATTRIBUTE) !== ghostText) {
    next.setAttribute(INLINE_SUGGESTION_ATTRIBUTE, ghostText);
  }
  return next;
}
