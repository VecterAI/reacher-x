"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  HISTORY_PUSH_TAG,
  KEY_DOWN_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  type LexicalEditor,
} from "lexical";
import {
  applyInlineSuggestionDecoration,
  getInlineSuggestionAnchorElement,
  readCaretTextFromDom,
} from "@/features/composer/lib/inlineSuggestionAnchor";
import type { InlineAutocompleteContext } from "@/shared/lib/autocomplete/inlineAutocomplete";
import { isInlineSuggestionWordAcceptKey } from "@/shared/lib/autocomplete/inlineSuggestionKeys";
import { useInlineAutocomplete } from "@/shared/hooks/useInlineAutocomplete";

function insertSuggestionText(editor: LexicalEditor, text: string) {
  editor.update(
    () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(text);
      }
    },
    { tag: HISTORY_PUSH_TAG }
  );
}

export function InlineAutocompletePlugin({
  inlineAutocompleteContext,
  editable = true,
}: {
  inlineAutocompleteContext?: InlineAutocompleteContext;
  editable?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [isComposing, setIsComposing] = useState(false);
  const {
    ghostText,
    announcement,
    updateRequest,
    getGhostText,
    acceptSuggestion,
    acceptNextWord,
    dismissSuggestion,
    hasPendingSuggestion,
    isGloballyEnabled,
  } = useInlineAutocomplete({
    request: undefined,
    enabled:
      editable && inlineAutocompleteContext?.enabled !== false && !isComposing,
  });
  // `aria-autocomplete` states the capability, so it does not follow the
  // ghost or transient states such as IME composition.
  const supportsInlineAutocomplete =
    editable &&
    inlineAutocompleteContext?.enabled !== false &&
    isGloballyEnabled;
  const contextRef = useRef(inlineAutocompleteContext);
  const decoratedElementRef = useRef<HTMLElement | null>(null);

  const decorate = useCallback(
    (text: string) => {
      decoratedElementRef.current = applyInlineSuggestionDecoration({
        previous: decoratedElementRef.current,
        target: text ? getInlineSuggestionAnchorElement(editor) : null,
        ghostText: text,
      });
    },
    [editor]
  );

  useEffect(() => {
    if (!supportsInlineAutocomplete) {
      return;
    }
    return editor.registerRootListener((nextRoot, prevRoot) => {
      prevRoot?.removeAttribute("aria-autocomplete");
      nextRoot?.setAttribute("aria-autocomplete", "inline");
    });
  }, [editor, supportsInlineAutocomplete]);

  /**
   * Reports the caret to the controller and re-attaches the ghost. Runs
   * synchronously after every Lexical update (edits and caret moves), when
   * Lexical has already reconciled the DOM and the DOM selection.
   */
  const syncCaret = useCallback(() => {
    const rootElement = editor.getRootElement();
    const caretText = rootElement ? readCaretTextFromDom(rootElement) : null;
    const hasAnchor = getInlineSuggestionAnchorElement(editor) !== null;

    updateRequest(
      caretText && hasAnchor
        ? {
            ...contextRef.current,
            surface: "composer",
            beforeCursor: caretText.beforeCursor,
            afterCursor: caretText.afterCursor,
          }
        : null
    );
    decorate(getGhostText());
  }, [decorate, editor, getGhostText, updateRequest]);

  useEffect(() => {
    contextRef.current = inlineAutocompleteContext;
    syncCaret();
  }, [inlineAutocompleteContext, syncCaret]);

  // A response arriving, or the controller trimming the ghost.
  useLayoutEffect(() => {
    decorate(ghostText);
  }, [decorate, ghostText]);

  useEffect(
    () => () => {
      decorate("");
    },
    [decorate]
  );

  useEffect(() => {
    const handleCompositionStart = () => setIsComposing(true);
    const handleCompositionEnd = () => {
      setIsComposing(false);
      syncCaret();
    };

    const detachComposition = (root: HTMLElement | null) => {
      root?.removeEventListener("compositionstart", handleCompositionStart);
      root?.removeEventListener("compositionend", handleCompositionEnd);
    };

    return mergeRegister(
      () => detachComposition(editor.getRootElement()),
      editor.registerUpdateListener(() => {
        syncCaret();
      }),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          const text = acceptSuggestion();
          if (!text) {
            return false;
          }
          event?.preventDefault();
          insertSuggestionText(editor, text);
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      // Lexical turns Ctrl/Cmd+Right into MOVE_TO_END, not
      // KEY_ARROW_RIGHT_COMMAND, so the word accept listens on raw keydown,
      // ahead of Lexical's own keydown handler (editor priority).
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (!isInlineSuggestionWordAcceptKey(event)) {
            return false;
          }
          const text = acceptNextWord();
          if (!text) {
            return false;
          }
          event.preventDefault();
          insertSuggestionText(editor, text);
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (!hasPendingSuggestion()) {
            return false;
          }
          const hadGhost = Boolean(getGhostText());
          dismissSuggestion("escape");
          if (!hadGhost) {
            // Only a pending request was canceled; nothing visible changed,
            // so let Escape keep its usual meaning (close a dialog, a menu).
            return false;
          }
          event?.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          dismissSuggestion("blur");
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerRootListener((nextRoot, prevRoot) => {
        detachComposition(prevRoot);
        nextRoot?.addEventListener("compositionstart", handleCompositionStart);
        nextRoot?.addEventListener("compositionend", handleCompositionEnd);
      })
    );
  }, [
    acceptNextWord,
    acceptSuggestion,
    dismissSuggestion,
    editor,
    getGhostText,
    hasPendingSuggestion,
    syncCaret,
  ]);

  return (
    <span role="status" className="sr-only">
      {announcement}
    </span>
  );
}
