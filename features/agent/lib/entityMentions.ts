import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";

/**
 * Text the agent composer inserts for a picked entity (`@<mentionText> `),
 * or null for attachments, which are attached rather than written inline.
 */
export function buildAgentMentionReplacementText(
  entity: MentionEntitySearchResult
) {
  if (entity.kind === "attachment") {
    return null;
  }

  const visibleText = entity.mentionText.trim();
  return visibleText ? `@${visibleText} ` : null;
}

/**
 * Returns the entity ids of the `MentionNode` chips in a serialized Lexical
 * editor state. A chip is atomic and stores the id of the entity the user
 * picked, so it is the source of truth for which entity a visible `@name`
 * refers to; two chips with the same name still carry different ids.
 */
export function collectComposerMentionIds(editorState: unknown): Set<string> {
  const mentionIds = new Set<string>();

  /** Depth-first walk that records the id of every mention chip. */
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return;
    }

    const current = node as {
      type?: unknown;
      mentionId?: unknown;
      children?: unknown;
    };

    if (current.type === "MentionNode") {
      if (typeof current.mentionId === "string" && current.mentionId) {
        mentionIds.add(current.mentionId);
      }
      return;
    }

    if (Array.isArray(current.children)) {
      for (const child of current.children) {
        visit(child);
      }
    }
  };

  visit((editorState as { root?: unknown } | null | undefined)?.root);
  return mentionIds;
}

/**
 * Keeps the selected entities whose mention chip is still in the composer.
 * Selection is bound to chip ids only: deleting a chip detaches exactly its
 * entity, and `@name` text typed or pasted by hand never re-links one.
 */
export function filterSelectedMentionEntitiesByMentionIds(args: {
  entities: MentionEntitySearchResult[];
  mentionIds: ReadonlySet<string>;
}) {
  return args.entities.filter((entity) => args.mentionIds.has(entity.id));
}
