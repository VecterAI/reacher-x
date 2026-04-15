"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  HISTORY_PUSH_TAG,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import {
  getInlineAutocompleteInsertionText,
  type InlineAutocompleteContext,
  type InlineAutocompleteRequest,
} from "@/shared/lib/autocomplete/inlineAutocomplete";
import { useInlineAutocomplete } from "@/shared/hooks/useInlineAutocomplete";

type CaretOverlayPosition = {
  top: number;
  left: number;
  maxWidth: number;
};

function getCollapsedCaretRect(range: Range) {
  const clientRects = range.getClientRects();
  if (clientRects.length > 0) {
    const rect = clientRects.item(clientRects.length - 1);
    if (rect) {
      return rect;
    }
  }
  return range.getBoundingClientRect();
}

export function InlineAutocompletePlugin({
  inlineAutocompleteContext,
  editable = true,
}: {
  inlineAutocompleteContext?: InlineAutocompleteContext;
  editable?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [request, setRequest] = useState<InlineAutocompleteRequest | null>(
    null
  );
  const [overlayPosition, setOverlayPosition] =
    useState<CaretOverlayPosition | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const { suggestion, dismissSuggestion, isLoading, recordAccepted } =
    useInlineAutocomplete({
      request,
      enabled:
        editable &&
        inlineAutocompleteContext?.enabled !== false &&
        !isComposing,
    });

  const updateSelectionRequest = useCallback(() => {
    const rootElement = editor.getRootElement();
    const selection = window.getSelection();

    if (
      !rootElement ||
      !selection ||
      selection.rangeCount === 0 ||
      !selection.isCollapsed ||
      !rootElement.contains(selection.anchorNode)
    ) {
      setRequest(null);
      setOverlayPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const beforeRange = range.cloneRange();
    beforeRange.selectNodeContents(rootElement);
    beforeRange.setEnd(range.endContainer, range.endOffset);

    const afterRange = range.cloneRange();
    afterRange.selectNodeContents(rootElement);
    afterRange.setStart(range.endContainer, range.endOffset);

    const beforeCursor = beforeRange.toString();
    const afterCursor = afterRange.toString();

    setRequest({
      ...inlineAutocompleteContext,
      surface: "composer",
      beforeCursor,
      afterCursor,
    });

    const caretRect = getCollapsedCaretRect(range);
    const rootRect = rootElement.getBoundingClientRect();
    const left = caretRect.left - rootRect.left + rootElement.scrollLeft;
    const top = caretRect.top - rootRect.top + rootElement.scrollTop;

    setOverlayPosition({
      top,
      left,
      maxWidth: Math.max(64, rootElement.clientWidth - left - 16),
    });
  }, [editor, inlineAutocompleteContext]);

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
    dismissSuggestion("manual");
  }, [dismissSuggestion]);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
    requestAnimationFrame(updateSelectionRequest);
  }, [updateSelectionRequest]);

  useEffect(() => {
    const updateAfterFrame = () => {
      requestAnimationFrame(updateSelectionRequest);
    };

    updateAfterFrame();

    const unregisterUpdate = editor.registerUpdateListener(() => {
      if (suggestion) {
        dismissSuggestion("input_changed");
      }
      updateAfterFrame();
    });

    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        if (suggestion) {
          dismissSuggestion("selection_changed");
        }
        updateAfterFrame();
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const unregisterAccept = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        if (!suggestion) {
          return false;
        }

        const insertionText = getInlineAutocompleteInsertionText({
          beforeCursor: request?.beforeCursor ?? "",
          suggestion,
        });

        if (!insertionText) {
          return false;
        }

        event?.preventDefault();
        editor.update(
          () => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText(insertionText);
            }
          },
          { tag: HISTORY_PUSH_TAG }
        );
        recordAccepted();
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    const unregisterEscape = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (event) => {
        if (!suggestion) {
          return false;
        }

        event?.preventDefault();
        dismissSuggestion("escape");
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    const unregisterRoot = editor.registerRootListener((nextRoot, prevRoot) => {
      if (prevRoot) {
        prevRoot.removeEventListener("scroll", updateAfterFrame);
        prevRoot.removeEventListener(
          "compositionstart",
          handleCompositionStart
        );
        prevRoot.removeEventListener("compositionend", handleCompositionEnd);
      }

      if (nextRoot) {
        nextRoot.addEventListener("scroll", updateAfterFrame);
        nextRoot.addEventListener("compositionstart", handleCompositionStart);
        nextRoot.addEventListener("compositionend", handleCompositionEnd);
      }
    });

    window.addEventListener("resize", updateAfterFrame);

    return () => {
      unregisterUpdate();
      unregisterSelection();
      unregisterAccept();
      unregisterEscape();
      unregisterRoot();
      window.removeEventListener("resize", updateAfterFrame);
    };
  }, [
    dismissSuggestion,
    editor,
    handleCompositionEnd,
    handleCompositionStart,
    recordAccepted,
    suggestion,
    updateSelectionRequest,
  ]);

  const shouldRenderSuggestion = useMemo(
    () =>
      Boolean(
        suggestion &&
        overlayPosition &&
        editable &&
        inlineAutocompleteContext?.enabled !== false &&
        !isLoading
      ),
    [
      editable,
      inlineAutocompleteContext?.enabled,
      isLoading,
      overlayPosition,
      suggestion,
    ]
  );

  if (!shouldRenderSuggestion || !overlayPosition) {
    return null;
  }

  return (
    <div
      className="text-muted-foreground pointer-events-none absolute z-20 overflow-hidden whitespace-nowrap text-sm opacity-55 select-none"
      style={{
        top: overlayPosition.top,
        left: overlayPosition.left,
        maxWidth: overlayPosition.maxWidth,
        WebkitMaskImage:
          "linear-gradient(to right, black 0%, black 82%, transparent 100%)",
        maskImage:
          "linear-gradient(to right, black 0%, black 82%, transparent 100%)",
      }}
    >
      {suggestion}
    </div>
  );
}
