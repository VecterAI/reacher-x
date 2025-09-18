"use client";

import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  $insertNodes,
  TextNode,
  $createParagraphNode,
  $getRoot,
  $setSelection,
  $createRangeSelection,
} from "lexical";

export type FormattingState = {
  isBold: boolean;
  isItalic: boolean;
};

export type ComposerEditorAPI = {
  toggleBold: () => void;
  toggleItalic: () => void;
  insertImages: (files: FileList) => void;
  insertEmoji: (emoji: string) => void;
  clearContent: () => void;
};

export function ToolbarBridgePlugin({
  onReady,
  onFormattingChange,
}: {
  onReady?: (api: ComposerEditorAPI) => void;
  onFormattingChange?: (state: FormattingState) => void;
}) {
  const [editor] = useLexicalComposerContext();

  // Ensure we only call onReady once per editor instance.
  const hasReportedReadyRef = useRef(false);

  // Keep last emitted formatting to avoid redundant parent updates.
  const lastFormattingRef = useRef<FormattingState>({
    isBold: false,
    isItalic: false,
  });

  // Store latest callbacks in refs so the effect doesn't depend on them.
  const onReadyRef = useRef<typeof onReady>(onReady);
  const onFormattingChangeRef =
    useRef<typeof onFormattingChange>(onFormattingChange);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onFormattingChangeRef.current = onFormattingChange;
  }, [onFormattingChange]);

  useEffect(() => {
    if (!hasReportedReadyRef.current) {
      onReadyRef.current?.({
        toggleBold: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"),
        toggleItalic: () =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"),
        insertImages: (files: FileList) => {
          const imageFiles = Array.from(files).filter((f) =>
            f.type.startsWith("image/")
          );
          if (imageFiles.length === 0) return;
          // Currently we rely on MediaUploadSection for previews; this hook
          // simply notifies via change. In-editor image nodes can be added
          // later using shadcn-editor Image Plugin.
        },
        insertEmoji: (emoji: string) => {
          editor.update(() => {
            const selection = $getSelection();

            if ($isRangeSelection(selection)) {
              // If there's an active selection, insert at the selection
              const textNode = new TextNode(emoji);
              $insertNodes([textNode]);
            } else {
              // If no selection (empty editor), create a selection at the end
              const root = $getRoot();
              const lastChild = root.getLastChild();

              if (lastChild) {
                // If there's a paragraph, select the end of it
                lastChild.selectEnd();
                const textNode = new TextNode(emoji);
                $insertNodes([textNode]);
              } else {
                // If editor is completely empty, create a paragraph and insert
                const paragraph = $createParagraphNode();
                const textNode = new TextNode(emoji);
                paragraph.append(textNode);
                root.append(paragraph);

                // Create a selection at the end of the inserted text
                const newSelection = $createRangeSelection();
                newSelection.anchor.set(
                  textNode.getKey(),
                  textNode.getTextContentSize(),
                  "text"
                );
                newSelection.focus.set(
                  textNode.getKey(),
                  textNode.getTextContentSize(),
                  "text"
                );
                $setSelection(newSelection);
              }
            }
          });
        },
        clearContent: () => {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
            const paragraph = $createParagraphNode();
            root.append(paragraph);
            const selection = $createRangeSelection();
            selection.anchor.set(paragraph.getKey(), 0, "element");
            selection.focus.set(paragraph.getKey(), 0, "element");
            $setSelection(selection);
          });
        },
      });
      hasReportedReadyRef.current = true;
    }

    const emitFormattingIfChanged = (next: FormattingState) => {
      const prev = lastFormattingRef.current;
      if (prev.isBold !== next.isBold || prev.isItalic !== next.isItalic) {
        lastFormattingRef.current = next;
        onFormattingChangeRef.current?.(next);
      }
    };

    // Emit initial state.
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        emitFormattingIfChanged({
          isBold: selection.hasFormat("bold"),
          isItalic: selection.hasFormat("italic"),
        });
      } else {
        emitFormattingIfChanged({ isBold: false, isItalic: false });
      }
    });

    // Listen for selection changes and emit formatting changes.
    const unregister = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            emitFormattingIfChanged({
              isBold: selection.hasFormat("bold"),
              isItalic: selection.hasFormat("italic"),
            });
          } else {
            emitFormattingIfChanged({ isBold: false, isItalic: false });
          }
        });
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    return unregister;
  }, [editor]);

  return null;
}
