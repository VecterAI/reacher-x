import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConversationReplyQuote } from "./ConversationReplyPreview";

describe("ConversationReplyQuote", () => {
  it("renders malformed provider attachments without throwing", () => {
    const html = renderToStaticMarkup(
      <ConversationReplyQuote
        quote={{
          id: "quoted-message",
          direction: "received",
          attachmentType: "attachment",
          attachments: [{ url: "https://media.example/file" } as never],
        }}
      />
    );

    expect(html).toContain("File attachment");
  });
});
