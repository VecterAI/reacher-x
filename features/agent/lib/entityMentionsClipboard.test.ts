// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { readMentionEntitiesFromHtml } from "./entityMentions";

const span = (entity: string) =>
  `<span data-mention-entity="${entity.replace(/"/g, "&quot;")}">@Jane Roe</span>`;

describe("readMentionEntitiesFromHtml (issue #141)", () => {
  it("reads valid entities from copied HTML and skips invalid ones", () => {
    const jane = JSON.stringify({
      id: "prospect:jane",
      entityId: "jane",
      kind: "prospect",
      label: "Jane Roe",
      mentionText: "Jane Roe",
      secondaryLabel: "@jane",
      avatarUrl: null,
      verified: false,
    });
    const html = span(jane) + span("{not json") + span('{"kind":"unknown"}');

    expect(readMentionEntitiesFromHtml(html)).toMatchObject([
      { id: "prospect:jane", entityId: "jane", kind: "prospect" },
    ]);
    expect(readMentionEntitiesFromHtml("<p>@Jane Roe</p>")).toEqual([]);
  });
});
