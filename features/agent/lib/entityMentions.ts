import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildAgentMentionReplacementText(
  entity: MentionEntitySearchResult
) {
  if (entity.kind === "attachment") {
    return null;
  }

  const visibleText = entity.mentionText.trim();
  return visibleText ? `@${visibleText} ` : null;
}

export type ComposerMentionState = {
  /** Entity ids carried by mention chips still present in the composer. */
  mentionIds: Set<string>;
  /** Composer text with every mention chip removed (typed/pasted text only). */
  textWithoutMentions: string;
};

/**
 * Walks a serialized Lexical editor state and collects the entity ids of the
 * `MentionNode` chips it holds, plus the text that is not part of any chip.
 * A chip is atomic and stores the id of the entity the user picked, so it is
 * the source of truth for which entity a visible `@name` refers to.
 */
export function collectComposerMentionState(
  editorState: unknown
): ComposerMentionState {
  const mentionIds = new Set<string>();
  const textParts: string[] = [];

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return;
    }

    const current = node as {
      type?: unknown;
      text?: unknown;
      mentionId?: unknown;
      children?: unknown;
    };

    if (current.type === "MentionNode") {
      if (typeof current.mentionId === "string" && current.mentionId) {
        mentionIds.add(current.mentionId);
      }
      // Keep a separator so text on both sides of a chip never merges.
      textParts.push(" ");
      return;
    }

    if (typeof current.text === "string") {
      textParts.push(current.text);
    }

    if (Array.isArray(current.children)) {
      for (const child of current.children) {
        visit(child);
      }
      // Block boundaries (paragraphs, list items) behave like line breaks.
      textParts.push("\n");
    }
  };

  const root = (editorState as { root?: unknown } | null | undefined)?.root;
  visit(root);

  return { mentionIds, textWithoutMentions: textParts.join("") };
}

export function filterSelectedMentionEntitiesByInput(args: {
  input: string;
  entities: MentionEntitySearchResult[];
  /**
   * Mention chips in the composer. When given, an entity stays selected only
   * if its own chip (matched by id) is still present, or if its `@name` was
   * typed or pasted as plain text outside any chip. Without it, selection
   * falls back to matching `@name` anywhere in `input`.
   */
  composerMentions?: ComposerMentionState | null;
}) {
  if (!args.input.trim()) {
    return [];
  }

  const composerMentions = args.composerMentions ?? null;
  const fallbackText = composerMentions
    ? composerMentions.textWithoutMentions
    : args.input;

  return args.entities.filter((entity) => {
    if (composerMentions?.mentionIds.has(entity.id)) {
      return true;
    }

    const visibleText = entity.mentionText.trim();
    if (!visibleText) {
      return false;
    }

    const mentionPattern = new RegExp(
      `(^|[\\s(])@${escapeRegExp(visibleText)}(?=$|[\\s),.!?:;\\]])`
    );

    return mentionPattern.test(fallbackText);
  });
}
