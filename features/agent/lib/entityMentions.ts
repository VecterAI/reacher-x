import {
  normalizeMentionEntitySearchResult,
  type MentionEntitySearchResult,
} from "@/shared/lib/mentions/mentionEntities";

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

export type AgentMentionSelection = {
  /**
   * Every inline entity picked from the mention menu in this composer scope,
   * in pick order. Never pruned when a chip is removed, so a chip that is cut
   * and pasted back re-tags its entity.
   */
  pickedEntities: MentionEntitySearchResult[];
  /** Entities currently tagged: inline ones with a chip, plus attachments. */
  selectedEntities: MentionEntitySearchResult[];
};

/**
 * Recomputes the tagged entities after the composer's chips change. Inline
 * entities are rebuilt from `pickedEntities` (not from the current selection),
 * so a chip brought back by paste is tagged again. Attachments are not
 * chips and are kept as they are. Returns the same array when nothing changed.
 */
export function syncMentionSelectionWithComposer(
  selection: AgentMentionSelection,
  mentionIds: ReadonlySet<string>
): MentionEntitySearchResult[] {
  const current = selection.selectedEntities;
  const next = [
    ...filterSelectedMentionEntitiesByMentionIds({
      entities: selection.pickedEntities,
      mentionIds,
    }),
    ...current.filter((entity) => entity.kind === "attachment"),
  ];

  const unchanged =
    next.length === current.length &&
    next.every((entity, index) => entity.id === current[index]?.id);
  return unchanged ? current : next;
}

/** `@` starting a word: at the start, or after whitespace or "(". */
const MENTION_TEXT_PATTERN = /(^|[\s(])@[\p{L}\p{N}_]/u;

/** True when the composer has `@name` text that is not a chip, so tags no one. */
export function hasUntaggedMentionText(editorState: unknown): boolean {
  // Join each paragraph's text so formatting that splits "@Jane" still counts;
  // chips and other inline nodes become a space.
  const textOf = (node: unknown): string => {
    if (!node || typeof node !== "object") {
      return "";
    }

    const current = node as {
      type?: unknown;
      text?: unknown;
      children?: unknown;
    };
    if (current.type === "text") {
      return typeof current.text === "string" ? current.text : "";
    }

    return Array.isArray(current.children)
      ? `${current.children.map(textOf).join("")}\n`
      : " ";
  };

  return MENTION_TEXT_PATTERN.test(
    textOf((editorState as { root?: unknown } | null | undefined)?.root)
  );
}

/** Inline entities whose name no other entity shares. */
export function getUnambiguousMentionEntities(
  entities: MentionEntitySearchResult[]
): MentionEntitySearchResult[] {
  const inline = entities.filter(
    (entity) => entity.kind !== "attachment" && entity.mentionText.trim()
  );
  const nameOf = (entity: MentionEntitySearchResult) =>
    entity.mentionText.trim();

  return inline.filter(
    (entity) =>
      inline.filter((other) => nameOf(other) === nameOf(entity)).length === 1
  );
}

/** Entities carried by mentions copied from a sent message (`data-mention-entity`). */
export function readMentionEntitiesFromHtml(
  html: string
): MentionEntitySearchResult[] {
  if (!html.includes("data-mention-entity")) {
    return [];
  }

  const document = new DOMParser().parseFromString(html, "text/html");
  return [...document.querySelectorAll("[data-mention-entity]")].flatMap(
    (element) => {
      try {
        const entity = normalizeMentionEntitySearchResult(
          JSON.parse(element.getAttribute("data-mention-entity") ?? "")
        );
        return entity ? [entity] : [];
      } catch {
        return [];
      }
    }
  );
}
