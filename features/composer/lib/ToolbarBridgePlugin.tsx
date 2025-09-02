"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";

export type FormattingState = {
  isBold: boolean;
  isItalic: boolean;
};

export type ComposerEditorAPI = {
  toggleBold: () => void;
  toggleItalic: () => void;
};

export function ToolbarBridgePlugin({
  onReady,
  onFormattingChange,
}: {
  onReady?: (api: ComposerEditorAPI) => void;
  onFormattingChange?: (state: FormattingState) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    onReady?.({
      toggleBold: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"),
      toggleItalic: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"),
    });

    // Emit initial state
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        onFormattingChange?.({
          isBold: selection.hasFormat("bold"),
          isItalic: selection.hasFormat("italic"),
        });
      } else {
        onFormattingChange?.({ isBold: false, isItalic: false });
      }
    });

    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            onFormattingChange?.({
              isBold: selection.hasFormat("bold"),
              isItalic: selection.hasFormat("italic"),
            });
          } else {
            onFormattingChange?.({ isBold: false, isItalic: false });
          }
        });
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, onReady, onFormattingChange]);

  return null;
}
