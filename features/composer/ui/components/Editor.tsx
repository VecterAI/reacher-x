"use client";

import * as React from "react";
import {
  InitialConfigType,
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { EditorState, SerializedEditorState } from "lexical";

import { editorTheme } from "@/shared/ui/components/editor/editorTheme";
import { TooltipProvider } from "@/shared/ui/components/Tooltip";

import { nodes } from "./nodes";
import { Plugins } from "./Plugins";
import { logger } from "@/shared/lib/logger";

// Keep this module-level config stable.
const editorConfig: InitialConfigType = {
  namespace: "Editor",
  theme: editorTheme,
  nodes,
  onError: (error: Error) => {
    logger.error(error);
  },
};

export function Editor({
  editorState,
  editorSerializedState,
  onChange,
  onSerializedChange,
  extraPlugins,
  placeholder = "Start typing ...",
  contentEditableClassName,
  composerPlaceholderClassName,
}: {
  editorState?: EditorState;
  editorSerializedState?: SerializedEditorState;
  onChange?: (editorState: EditorState) => void;
  onSerializedChange?: (editorSerializedState: SerializedEditorState) => void;
  extraPlugins?: React.ReactNode;
  placeholder?: string;
  contentEditableClassName?: string;
  composerPlaceholderClassName?: string;
}) {
  // Build initialConfig once to avoid re-creating the editor on every render.
  const initialConfig = React.useMemo<InitialConfigType>(() => {
    const base: InitialConfigType = { ...editorConfig };

    // Only use an initial value at mount time.
    if (editorState) {
      return { ...base, editorState };
    }
    if (editorSerializedState) {
      return { ...base, editorState: JSON.stringify(editorSerializedState) };
    }
    return base;
    // Intentionally run only once on mount so LexicalComposer isn't remounted
    // by changing prop identities. This prevents infinite update loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-background overflow-hidden">
      <TooltipProvider>
        <LexicalComposer initialConfig={initialConfig}>
          <Plugins
            placeholder={placeholder}
            contentEditableClassName={contentEditableClassName}
            composerPlaceholderClassName={composerPlaceholderClassName}
          />
          {extraPlugins}

          <OnChangePlugin
            ignoreSelectionChange
            onChange={(state: EditorState) => {
              onChange?.(state);
              onSerializedChange?.(state.toJSON());
            }}
          />
        </LexicalComposer>
      </TooltipProvider>
    </div>
  );
}
