"use client";

import { useState, useCallback } from "react";
import { SerializedEditorState } from "lexical";
import { cn } from "@/shared/lib/utils/utils";
import { Editor } from "@/components/blocks/editor-00/editor";
import { ComposerBaseProps } from "../types";

interface ComposerEditorProps extends ComposerBaseProps {
  showToolbar?: boolean;
  showCharacterCount?: boolean;
  className?: string;
}

export function ComposerEditor({
  maxLength = 280,
  showCharacterCount = true,
  className,
  onContentChange,
}: ComposerEditorProps) {
  const [editorState, setEditorState] = useState<
    SerializedEditorState | undefined
  >(undefined);

  const handleContentChange = useCallback(
    (newState: SerializedEditorState) => {
      setEditorState(newState);
      onContentChange?.(newState);
    },
    [onContentChange]
  );

  // Calculate character count from editor state
  const getCharacterCount = (
    state: SerializedEditorState | undefined
  ): number => {
    if (!state) return 0;
    let count = 0;
    const traverse = (node: Record<string, unknown>) => {
      if (typeof node.text === "string") {
        count += node.text.length;
      }
      if (Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };
    traverse(state.root);
    return count;
  };

  const characterCount = getCharacterCount(editorState);
  const isOverLimit = characterCount > maxLength;

  return (
    <div className={cn("relative", className)}>
      {/* Editor */}
      <div className="relative">
        <Editor
          editorSerializedState={editorState}
          onSerializedChange={handleContentChange}
        />
      </div>

      {/* Character Count */}
      {showCharacterCount && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className={cn(isOverLimit && "text-destructive")}>
            {characterCount}/{maxLength}
          </span>
        </div>
      )}

      {/* Error State */}
      {isOverLimit && (
        <div className="mt-1 text-xs text-destructive">
          Character limit exceeded
        </div>
      )}
    </div>
  );
}
