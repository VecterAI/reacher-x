// @vitest-environment node

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
}));

vi.mock("unipile-node-sdk", () => ({
  UnipileClient: class {
    messaging = { sendMessage: sendMessageMock };
  },
  UnipileError: class extends Error {
    body: unknown;

    constructor(raw: { message: string; body?: unknown }) {
      super(raw.message);
      this.body = raw.body;
    }
  },
}));

import { sendLinkedInChatMessage } from "./unipileClient";

describe("LinkedIn quoted-message delivery", () => {
  beforeAll(() => {
    process.env.UNIPILE_BASE_URL = "https://example.unipile.test";
    process.env.UNIPILE_API_KEY = "test-api-key";
  });

  beforeEach(() => {
    sendMessageMock.mockReset();
  });

  it("sends the documented Unipile message id through the SDK", async () => {
    sendMessageMock.mockResolvedValue({ message_id: "sent-message" });

    await expect(
      sendLinkedInChatMessage({
        accountId: "account-id",
        chatId: "chat-id",
        text: "Reply",
        quoteId: "unipile-message-id",
        quoteProviderId: "provider-message-id",
      })
    ).resolves.toEqual({ message_id: "sent-message" });

    expect(sendMessageMock).toHaveBeenCalledOnce();
    expect(sendMessageMock).toHaveBeenCalledWith(
      { chat_id: "chat-id", text: "Reply" },
      {
        extra_params: {
          account_id: "account-id",
          quote_id: "unipile-message-id",
        },
      }
    );
  });

  it("falls back to the native provider id only after a non-delivery 422", async () => {
    sendMessageMock
      .mockRejectedValueOnce({
        body: {
          status: 422,
          type: "errors/unprocessable_entity",
          detail: "The provider could not process the quote id.",
        },
      })
      .mockResolvedValueOnce({ message_id: "sent-with-provider-id" });

    await expect(
      sendLinkedInChatMessage({
        accountId: "account-id",
        chatId: "chat-id",
        text: "Reply",
        quoteId: "unipile-message-id",
        quoteProviderId: "provider-message-id",
      })
    ).resolves.toEqual({ message_id: "sent-with-provider-id" });

    expect(sendMessageMock).toHaveBeenNthCalledWith(
      2,
      { chat_id: "chat-id", text: "Reply" },
      {
        extra_params: {
          account_id: "account-id",
          quote_id: "provider-message-id",
        },
      }
    );
  });

  it("never retries an ambiguous provider failure", async () => {
    sendMessageMock.mockRejectedValue({
      body: {
        status: 503,
        type: "errors/service_unavailable",
        detail: "Provider unavailable.",
      },
    });

    await expect(
      sendLinkedInChatMessage({
        accountId: "account-id",
        chatId: "chat-id",
        text: "Reply",
        quoteId: "unipile-message-id",
        quoteProviderId: "provider-message-id",
      })
    ).rejects.toMatchObject({ classification: "service_unavailable" });
    expect(sendMessageMock).toHaveBeenCalledOnce();
  });
});
