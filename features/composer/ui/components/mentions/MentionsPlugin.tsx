"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, $createTextNode } from "lexical";
import { $createMentionNode } from "./MentionNode";

const TRIGGER = "@";

const MOCK_USERS = [
  { id: "1", handle: "sundar", name: "Sundar" },
  { id: "2", handle: "elonmusk", name: "Elon Musk" },
  { id: "3", handle: "pmarca", name: "Marc Andreessen" },
  { id: "4", handle: "naval", name: "Naval Ravikant" },
  { id: "5", handle: "balajis", name: "Balaji Srinivasan" },
];

interface MentionSuggestion {
  id: string;
  handle: string;
  name: string;
}

export function MentionsPlugin() {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerPosition, setTriggerPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => {
    if (!query) return MOCK_USERS.slice(0, 5);

    const q = query.toLowerCase();
    return MOCK_USERS.filter(
      (u) =>
        u.handle.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [query]);

  const insertMention = useCallback(
    (suggestion: MentionSuggestion) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        // Find the @ trigger and replace it with the mention
        const anchorNode = selection.anchor.getNode();
        const textContent = anchorNode.getTextContent();
        const anchorOffset = selection.anchor.offset;

        // Find the start of the @ mention
        let mentionStart = anchorOffset - 1;
        while (mentionStart >= 0 && textContent[mentionStart] !== TRIGGER) {
          mentionStart--;
        }

        if (mentionStart >= 0) {
          // Remove the @ and query text
          const beforeMention = textContent.substring(0, mentionStart);
          const afterMention = textContent.substring(anchorOffset);

          // Create new text nodes
          const beforeNode = $createTextNode(beforeMention);
          const mentionNode = $createMentionNode(
            suggestion.handle,
            suggestion.id
          );
          const afterNode = $createTextNode(afterMention);

          // Replace the current text node
          anchorNode.remove();

          // Insert the new nodes
          const parent = anchorNode.getParent();
          if (parent) {
            if (beforeMention) {
              parent.append(beforeNode);
            }
            parent.append(mentionNode);
            if (afterMention) {
              parent.append(afterNode);
              afterNode.select();
            } else {
              // Select after the mention node
              mentionNode.selectNext();
            }
          }
        }
      });

      setOpen(false);
      setQuery("");
      setSelectedIndex(0);
    },
    [editor]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex(
            (prev) => (prev - 1 + results.length) % results.length
          );
          break;
        case "Enter":
        case "Tab":
          event.preventDefault();
          if (results[selectedIndex]) {
            insertMention(results[selectedIndex]);
          }
          break;
        case "Escape":
          event.preventDefault();
          setOpen(false);
          setQuery("");
          setSelectedIndex(0);
          break;
      }
    },
    [open, results, selectedIndex, insertMention]
  );

  const onKeyUp = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        setOpen(false);
        return;
      }

      const anchorNode = selection.anchor.getNode();
      const textContent = anchorNode.getTextContent();
      const anchorOffset = selection.anchor.offset;

      // Look for @ trigger in the current text
      const textBeforeCursor = textContent.substring(0, anchorOffset);
      const match = textBeforeCursor.match(/(^|\s)@([\w._-]*)$/);

      if (match) {
        const query = match[2] || "";
        setQuery(query);
        setOpen(true);
        setSelectedIndex(0);

        // Calculate position for the dropdown
        const range = document.createRange();
        const textNode = (
          anchorNode as { getDOMNode?: () => Node }
        ).getDOMNode?.();
        if (textNode && match.index !== undefined) {
          try {
            range.setStart(textNode, match.index + 1);
            range.setEnd(textNode, anchorOffset);
            const rect = range.getBoundingClientRect();
            setTriggerPosition({
              x: rect.left,
              y: rect.bottom + window.scrollY,
            });
          } catch {
            // Fallback to a default position
            setTriggerPosition({
              x: 0,
              y: 0,
            });
          }
        }
      } else {
        setOpen(false);
        setQuery("");
      }
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerRootListener((rootElem, prev) => {
      if (prev) prev.removeEventListener("keyup", onKeyUp);
      if (rootElem) rootElem.addEventListener("keyup", onKeyUp);
    });
  }, [editor, onKeyUp]);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open || results.length === 0) return null;

  return (
    <div
      ref={anchorRef}
      className="fixed z-50 max-h-64 w-64 overflow-auto rounded-md border bg-background p-1 text-sm shadow-md"
      style={{
        left: triggerPosition?.x || 0,
        top: triggerPosition?.y || 0,
      }}
    >
      {results.map((user, index) => (
        <div
          key={user.id}
          className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted ${
            index === selectedIndex ? "bg-muted" : ""
          }`}
          onClick={() => insertMention(user)}
        >
          <span className="font-mono text-muted-foreground">
            @{user.handle}
          </span>
          <span className="text-foreground">{user.name}</span>
        </div>
      ))}
    </div>
  );
}
