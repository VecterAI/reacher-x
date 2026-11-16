// @vitest-environment happy-dom
import {
  $createParagraphNode,
  $getRoot,
  $parseSerializedNode,
  createEditor,
} from "lexical";
import { describe, expect, it } from "vitest";
import {
  $createMentionNode,
  MentionNode,
} from "@/features/composer/ui/components/mentions/MentionNode";
import {
  hasUntaggedMentionChip,
  readMentionEntitiesFromHtml,
} from "./entityMentions";

const jane = {
  id: "prospect:jane",
  entityId: "jane",
  kind: "prospect" as const,
  label: "Jane Roe",
  mentionText: "Jane Roe",
  secondaryLabel: "@jane",
  avatarUrl: null,
  verified: false,
};

const span = (entity: string) =>
  `<span data-mention-entity="${entity.replace(/"/g, "&quot;")}">@Jane Roe</span>`;

describe("readMentionEntitiesFromHtml (issue #141)", () => {
  it("reads valid entities from copied HTML and skips invalid ones", () => {
    const html =
      span(JSON.stringify(jane)) +
      span("{not json") +
      span('{"kind":"unknown"}');

    expect(readMentionEntitiesFromHtml(html)).toMatchObject([
      { id: "prospect:jane", entityId: "jane", kind: "prospect" },
    ]);
    expect(readMentionEntitiesFromHtml("<p>@Jane Roe</p>")).toEqual([]);
  });
});

describe("cut chip pasted after a refresh (issue #146)", () => {
  const editor = createEditor({
    nodes: [MentionNode],
    onError: (error) => {
      throw error;
    },
  });

  /** Clipboard HTML of a chip after a cut, an in-editor paste, and a second cut. */
  const recutChipHtml = () => {
    let html = "";
    editor.update(
      () => {
        const chip = $createMentionNode(
          "Jane Roe",
          jane.id,
          JSON.stringify(jane)
        );
        const pasted = $parseSerializedNode(chip.exportJSON()) as MentionNode;
        $getRoot().clear().append($createParagraphNode().append(pasted));
        html = (pasted.exportDOM().element as HTMLElement).outerHTML;
      },
      { discrete: true }
    );
    return html;
  };

  it("carries the picked entity on the clipboard so paste can tag it again", () => {
    expect(readMentionEntitiesFromHtml(recutChipHtml())).toMatchObject([
      { id: jane.id, entityId: "jane" },
    ]);
  });

  it("flags a chip whose entity was never picked", () => {
    recutChipHtml();
    const state = editor.getEditorState().toJSON();

    expect(hasUntaggedMentionChip(state, [])).toBe(true);
    expect(hasUntaggedMentionChip(state, [jane])).toBe(false);
  });
});
