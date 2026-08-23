// @vitest-environment node

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { requestSendMock } = vi.hoisted(() => ({
  requestSendMock: vi.fn(),
}));

vi.mock("unipile-node-sdk", () => ({
  UnipileClient: class {
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

import { setLinkedInMessageReaction } from "./unipileClient";

describe("LinkedIn message reaction request", () => {
  beforeAll(() => {
    process.env.UNIPILE_BASE_URL = "https://example.unipile.test";
    process.env.UNIPILE_API_KEY = "test-api-key";
  });

  beforeEach(() => {
    requestSendMock.mockReset();
  });

  it("posts the native emoji to the documented v1 message route", async () => {
    requestSendMock.mockResolvedValue({ success: true });

    await expect(
      setLinkedInMessageReaction({
        messageId: "message/id",
        reaction: "👍",
      })
    ).resolves.toEqual({ success: true });

    expect(requestSendMock).toHaveBeenCalledWith({
      path: ["messages", "message%2Fid", "reaction"],
      method: "POST",
      parameters: {},
      body: { reaction: "👍" },
      headers: { "Content-Type": "application/json" },
    });
  });
});
