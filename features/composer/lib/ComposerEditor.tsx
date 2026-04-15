"use client";

import React, { useCallback, useMemo, useState } from "react";
import { SerializedEditorState } from "lexical";
import { cn } from "@/shared/lib/utils";
import { Editor } from "@/features/composer/ui/components/Editor";
import {
  ToolbarBridgePlugin,
  ComposerEditorAPI,
  FormattingState,
} from "./ToolbarBridgePlugin";
import { ComposerBaseProps } from "../types";
import { getXPostWeightedLength } from "@/shared/lib/twitter/xPostTextLimit";
import { extractTextFromEditorState } from "@/shared/lib/utils/url/urlDetection";

interface ComposerEditorProps extends ComposerBaseProps {
  showToolbar?: boolean;
  showCharacterCount?: boolean;
  className?: string;
  onBridgeReady?: (api: ComposerEditorAPI) => void;
  onFormattingChange?: (state: FormattingState) => void;
  extraPlugins?: React.ReactNode;
}

export function ComposerEditor({
  initialContent,
  placeholder,
  maxLength = 280,
  characterCountMode = "x_post",
  showCharacterCount = true,
  disabled = false,
  className,
  contentEditableClassName,
  composerPlaceholderClassName,
  inlineAutocompleteContext,
  onContentChange,
  onBridgeReady,
  onFormattingChange,
  extraPlugins,
}: ComposerEditorProps) {
  const [editorState, setEditorState] = useState<
    SerializedEditorState | undefined
  >(initialContent);

  const handleContentChange = useCallback(
    (newState: SerializedEditorState) => {
      if (disabled) {
        return;
      }
      setEditorState(newState);
      onContentChange?.(newState);
    },
    [disabled, onContentChange]
  );

  const characterCount = useMemo(() => {
    if (!editorState) return 0;
    const plain = extractTextFromEditorState(editorState);
    return characterCountMode === "x_post"
      ? getXPostWeightedLength(plain)
      : plain.length;
  }, [editorState, characterCountMode]);

  const isOverLimit = characterCount > maxLength;

  return (
    <div
      className={cn("relative", className)}
      onPaste={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        const dt = e.clipboardData;
        if (!dt) return;
        const files = dt.files;
        if (files && files.length > 0) {
          // Handled upstream via BaseComposer media flow.
        }
      }}
      onDrop={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          // Handled upstream via BaseComposer media flow.
          e.preventDefault();
        }
      }}
    >
      {/* Editor */}
      <div className="relative">
        <Editor
          editorSerializedState={editorState}
          onSerializedChange={handleContentChange}
          placeholder={placeholder}
          contentEditableClassName={contentEditableClassName}
          composerPlaceholderClassName={composerPlaceholderClassName}
          editable={!disabled}
          inlineAutocompleteContext={inlineAutocompleteContext}
          extraPlugins={
            <>
              <ToolbarBridgePlugin
                onReady={onBridgeReady}
                onFormattingChange={onFormattingChange}
              />
              {extraPlugins}
            </>
          }
        />
        {/* Bridge plugin is mounted via Editor.extraPlugins */}
      </div>

      {/* Character Count */}
      {showCharacterCount && (
        <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
          <span className={cn(isOverLimit && "text-destructive")}>
            {characterCount.toLocaleString("en-US", { useGrouping: false })}/
            {maxLength}
          </span>
        </div>
      )}

      {/* Error State */}
      {isOverLimit && (
        <div className="mt-1 text-xs text-red-500">
          Character limit exceeded
        </div>
      )}
    </div>
  );
}
