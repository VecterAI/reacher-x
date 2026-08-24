// @vitest-environment node

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { requestSendMock, sendMessageMock, setChatStatusMock } = vi.hoisted(
  () => ({
    requestSendMock: vi.fn(),
    sendMessageMock: vi.fn(),
    setChatStatusMock: vi.fn(),
  })
);

vi.mock("unipile-node-sdk", () => ({
  UnipileClient: class {
    messaging = {
      sendMessage: sendMessageMock,
      setChatStatus: setChatStatusMock,
    };
    request = { send: requestSendMock };
  },
  UnipileError: class extends Error {
    body: unknown;

    constructor(raw: { message: string; body?: unknown }) {
      super(raw.message);
      this.body = raw.body;
    }
  },
}));

import {
  sendLinkedInChatMessage,
  setLinkedInChatReadStatus,
} from "./unipileClient";

describe("LinkedIn quoted-message delivery", () => {
  beforeAll(() => {
    process.env.UNIPILE_BASE_URL = "https://example.unipile.test";
    process.env.UNIPILE_API_KEY = "test-api-key";
  });

  beforeEach(() => {
    sendMessageMock.mockReset();
    requestSendMock.mockReset();
    setChatStatusMock.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

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

  it("sends audio through the stable v1 voice_message field", async () => {
    requestSendMock.mockResolvedValue({ message_id: "voice-message" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: {
              "content-type": "audio/mp4;codecs=mp4a.40.2",
            },
          })
      )
    );

    await expect(
      sendLinkedInChatMessage({
        accountId: "account-id",
        chatId: "chat-id",
        voiceMessageUrl: "https://media.test/storage/voice-storage-id",
      })
    ).resolves.toEqual({ message_id: "voice-message" });

    const request = requestSendMock.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      path: ["chats", "chat-id", "messages"],
      method: "POST",
      parameters: {},
      headers: undefined,
    });
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.body.get("account_id")).toBe("account-id");
    const voiceMessage = request.body.get("voice_message");
    expect(voiceMessage).toBeInstanceOf(Blob);
    expect((voiceMessage as Blob).type).toBe("audio/x-m4a");
    expect((voiceMessage as File).name).toBe("voice-storage-id.m4a");
  });

  it("marks a LinkedIn chat read through the v1 SDK action", async () => {
    setChatStatusMock.mockResolvedValue({ object: "ChatPatched" });

    await expect(
      setLinkedInChatReadStatus({
        accountId: "account-id",
        chatId: "chat-id",
        read: true,
      })
    ).resolves.toEqual({ object: "ChatPatched" });
    expect(setChatStatusMock).toHaveBeenCalledWith(
      { chat_id: "chat-id", action: "setReadStatus", value: true },
      { extra_params: { account_id: "account-id" } }
    );
  });
});
