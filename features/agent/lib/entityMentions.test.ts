import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $parseSerializedNode,
  createEditor,
  type LexicalEditor,
} from "lexical";
import { describe, expect, it } from "vitest";
import {
  $createMentionNode,
  $isMentionNode,
  MentionNode,
} from "@/features/composer/ui/components/mentions/MentionNode";
import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";
import { extractTextFromEditorState } from "@/shared/lib/utils/url/urlDetection";
import {
  collectComposerMentionIds,
  filterSelectedMentionEntitiesByMentionIds,
} from "./entityMentions";

function buildPersonEntity(
  id: string,
  name: string
): MentionEntitySearchResult {
  return {
    id: `prospect:${id}`,
    entityId: id,
    kind: "prospect",
    label: name,
    mentionText: name,
    secondaryLabel: `@${id}`,
    avatarUrl: null,
    verified: false,
    handle: id,
  };
}

type Segment = { text: string } | { mention: MentionEntitySearchResult };

/** Headless editor with the same MentionNode the agent composer registers. */
function createComposerEditor(): LexicalEditor {
  return createEditor({
    namespace: "agent-mention-test",
    nodes: [MentionNode],
    onError: (error) => {
      throw error;
    },
  });
}

/** Replaces the editor content with one paragraph of text and chips. */
function setComposerContent(editor: LexicalEditor, segments: Segment[]) {
  editor.update(
    () => {
      const paragraph = $createParagraphNode();
      for (const segment of segments) {
        paragraph.append(
          "mention" in segment
            ? $createMentionNode(
                segment.mention.mentionText,
                segment.mention.id
              )
            : $createTextNode(segment.text)
        );
      }
      $getRoot().clear().append(paragraph);
    },
    { discrete: true }
  );
}

/** Same derivation AgentChat runs on every composer change. */
function selectedIds(
  editor: LexicalEditor,
  entities: MentionEntitySearchResult[]
) {
  const serialized = editor.getEditorState().toJSON();
  return filterSelectedMentionEntitiesByMentionIds({
    entities,
    mentionIds: collectComposerMentionIds(serialized),
  }).map((entity) => entity.id);
}

function composerText(editor: LexicalEditor) {
  return extractTextFromEditorState(editor.getEditorState().toJSON());
}

describe("agent mention selection by chip id", () => {
  const johnA = buildPersonEntity("john-a", "John Smith");
  const johnB = buildPersonEntity("john-b", "John Smith");

  it("deleting one of two same-named chips detaches only that entity", () => {
    const editor = createComposerEditor();
    setComposerContent(editor, [
      { text: "Compare " },
      { mention: johnA },
      { text: " and " },
      { mention: johnB },
    ]);
    expect(selectedIds(editor, [johnA, johnB])).toEqual([johnA.id, johnB.id]);

    editor.update(
      () => {
        const chips = $getRoot()
          .getFirstChildOrThrow<ReturnType<typeof $createParagraphNode>>()
          .getChildren()
          .filter($isMentionNode);
        chips[0]?.remove();
      },
      { discrete: true }
    );

    // The visible text still reads "@John Smith", but only johnB's chip is left.
    expect(composerText(editor)).toBe("Compare  and @John Smith");
    expect(selectedIds(editor, [johnA, johnB])).toEqual([johnB.id]);
  });

  it("deleting a chip whose name prefixes another chip detaches it", () => {
    const john = buildPersonEntity("john", "John");
    const johnSmith = buildPersonEntity("john-smith", "John Smith");
    const editor = createComposerEditor();
    setComposerContent(editor, [
      { text: "Ask " },
      { mention: johnSmith },
      { text: " today" },
    ]);

    expect(composerText(editor)).toBe("Ask @John Smith today");
    expect(selectedIds(editor, [john, johnSmith])).toEqual([johnSmith.id]);
  });

  it("hand-typed or pasted @name text never re-links an entity", () => {
    const jane = buildPersonEntity("jane", "Jane Roe");
    const editor = createComposerEditor();

    setComposerContent(editor, [
      { mention: jane },
      { text: " and @John Smith" },
    ]);
    expect(selectedIds(editor, [johnA, jane])).toEqual([jane.id]);

    // Plain text only, as after replaceContent() or a plain-text paste.
    setComposerContent(editor, [{ text: "Follow up with @John Smith" }]);
    expect(selectedIds(editor, [johnA, jane])).toEqual([]);
  });

  it("undo restores the deleted chip together with its entity id", () => {
    const editor = createComposerEditor();
    setComposerContent(editor, [
      { mention: johnA },
      { text: " " },
      { mention: johnB },
    ]);
    // HistoryPlugin undo re-applies a previous EditorState.
    const beforeDelete = editor.getEditorState();

    editor.update(
      () => {
        $getRoot()
          .getFirstChildOrThrow<ReturnType<typeof $createParagraphNode>>()
          .getChildren()
          .filter($isMentionNode)
          .find((chip) => chip.getMentionId() === johnB.id)
          ?.remove();
      },
      { discrete: true }
    );
    expect(selectedIds(editor, [johnA, johnB])).toEqual([johnA.id]);

    editor.setEditorState(beforeDelete);
    expect(selectedIds(editor, [johnA, johnB])).toEqual([johnA.id, johnB.id]);
  });

  it("copy-paste of a chip keeps the entity id it was created with", () => {
    const editor = createComposerEditor();
    setComposerContent(editor, [{ mention: johnB }]);

    // Lexical's clipboard serialises copied nodes with exportJSON and rebuilds
    // them with $parseSerializedNode on paste.
    editor.update(
      () => {
        const paragraph =
          $getRoot().getFirstChildOrThrow<
            ReturnType<typeof $createParagraphNode>
          >();
        const chip = paragraph.getChildren().find($isMentionNode);
        if (!chip) {
          throw new Error("chip missing");
        }
        const pasted = $parseSerializedNode(chip.exportJSON());
        chip.remove();
        paragraph.append($createTextNode("again: "), pasted);
      },
      { discrete: true }
    );

    expect(composerText(editor)).toBe("again: @John Smith");
    expect(selectedIds(editor, [johnA, johnB])).toEqual([johnB.id]);
  });

  it("IME composition edits text nodes only and leaves chip ids intact", () => {
    const editor = createComposerEditor();
    setComposerContent(editor, [{ mention: johnA }, { text: " " }]);

    // A committed composition lands in the TextNode next to the chip; the chip
    // is an atomic DecoratorNode, so composed text cannot enter or rename it.
    editor.update(
      () => {
        const textNode = $getRoot().getAllTextNodes().at(-1);
        textNode?.setTextContent(" こんにちは @John Smith");
      },
      { discrete: true }
    );

    expect(selectedIds(editor, [johnA, johnB])).toEqual([johnA.id]);
  });

  it("an empty or missing composer state selects nothing", () => {
    expect(collectComposerMentionIds(undefined)).toEqual(new Set());
    expect(collectComposerMentionIds({ root: { children: [] } })).toEqual(
      new Set()
    );
  });
});
