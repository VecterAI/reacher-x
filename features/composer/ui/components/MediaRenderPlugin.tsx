"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from "lexical";
import { $isMediaNode, MediaNode } from "./MediaNode";
import { MediaUploadSection } from "./MediaUploadSection";
import { MediaUpload } from "../../types";

interface MediaRenderPluginProps {
  onMediaChange?: (mediaUploads: MediaUpload[]) => void;
  existingUploads?: MediaUpload[]; // Pass existing uploads to prevent duplicates
}

export function MediaRenderPlugin({
  onMediaChange,
  existingUploads = [],
}: MediaRenderPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [mediaNodes, setMediaNodes] = useState<Map<string, MediaNode>>(
    new Map()
  );

  // Convert media nodes to media uploads for rendering
  const uploads = useMemo(() => {
    // Only create uploads for media nodes that don't have corresponding uploads
    // This prevents duplicate rendering when media is handled through MediaUploadSection
    return Array.from(mediaNodes.values())
      .filter((node) => {
        const mediaId = node.getMediaId();
        return !existingUploads.some((upload) => upload.id === mediaId);
      })
      .map((node) => {
        const mediaId = node.getMediaId();
        // Create a placeholder upload for nodes that don't have corresponding uploads
        return {
          id: mediaId,
          file: new File([], "media-placeholder", { type: "image/png" }),
          type: "image" as const,
          progress: 100,
          status: "completed" as const,
          url: "", // Will be handled by the node's data
        };
      });
  }, [mediaNodes, existingUploads]);

  // Update media nodes when editor state changes
  const updateMediaNodes = useCallback(() => {
    editor.getEditorState().read(() => {
      const root = editor.getRootElement();
      if (!root) return;

      const mediaElements = root.querySelectorAll(
        '[data-lexical-media="true"]'
      );
      const newMediaNodes = new Map<string, MediaNode>();

      mediaElements.forEach((element) => {
        const mediaId = element.getAttribute("data-media-id");
        if (mediaId) {
          // Find the corresponding Lexical node
          const allNodes = editor.getEditorState()._nodeMap;
          for (const [, node] of allNodes) {
            if ($isMediaNode(node) && node.getMediaId() === mediaId) {
              newMediaNodes.set(mediaId, node);
              break;
            }
          }
        }
      });

      setMediaNodes(newMediaNodes);
    });
  }, [editor]);

  // Handle media removal
  const handleRemoveMedia = useCallback(
    (mediaId: string) => {
      editor.update(() => {
        const allNodes = editor.getEditorState()._nodeMap;
        for (const [, node] of allNodes) {
          if ($isMediaNode(node) && node.getMediaId() === mediaId) {
            node.remove();
            break;
          }
        }
      });
    },
    [editor]
  );

  // Handle media description updates
  const handleAddDescription = useCallback(
    (mediaId: string, description: string) => {
      // This could be extended to store descriptions in the node or a separate store
      console.log(`Description for ${mediaId}:`, description);
    },
    []
  );

  // Handle keyboard deletion of media nodes
  useEffect(() => {
    return editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event: KeyboardEvent) => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const nodes = selection.getNodes();
          for (const node of nodes) {
            if ($isMediaNode(node)) {
              event.preventDefault();
              node.remove();
              return true;
            }
          }
        });
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_DELETE_COMMAND,
      (event: KeyboardEvent) => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const nodes = selection.getNodes();
          for (const node of nodes) {
            if ($isMediaNode(node)) {
              event.preventDefault();
              node.remove();
              return true;
            }
          }
        });
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  // Update media nodes when editor state changes
  useEffect(() => {
    const unregister = editor.registerUpdateListener(() => {
      updateMediaNodes();
    });

    return unregister;
  }, [editor, updateMediaNodes]);

  // Notify parent of media changes
  useEffect(() => {
    onMediaChange?.(uploads);
  }, [onMediaChange]);

  if (uploads.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <MediaUploadSection
        uploads={uploads}
        onRemove={handleRemoveMedia}
        onAddDescription={handleAddDescription}
      />
    </div>
  );
}
