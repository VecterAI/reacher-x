import { describe, expect, it } from "vitest";
import {
  buildXChatMediaUploadAppendRequest,
  parseXChatMediaUploadInitializeResponse,
  XCHAT_MEDIA_UPLOAD_CHUNK_BYTES,
} from "./xdkTwitterProvider";

describe("parseXChatMediaUploadInitializeResponse", () => {
  it("accepts the camel-cased response returned by the X SDK", () => {
    expect(
      parseXChatMediaUploadInitializeResponse({
        data: {
          conversationId: "1-2",
          mediaHashKey: "media-hash",
          sessionId: "upload-session",
        },
      })
    ).toEqual({
      sessionId: "upload-session",
      mediaHashKey: "media-hash",
    });
  });

  it("accepts the official snake-cased API response", () => {
    expect(
      parseXChatMediaUploadInitializeResponse({
        data: {
          conversation_id: "1-2",
          media_hash_key: "media-hash",
          session_id: "upload-session",
        },
      })
    ).toEqual({
      sessionId: "upload-session",
      mediaHashKey: "media-hash",
    });
  });

  it("rejects incomplete upload sessions", () => {
    expect(() => parseXChatMediaUploadInitializeResponse({ data: {} })).toThrow(
      "session ID"
    );
  });
});

describe("buildXChatMediaUploadAppendRequest", () => {
  it("keeps base64 append bodies below common multi-megabyte proxy limits", () => {
    const base64Bytes = Math.ceil(XCHAT_MEDIA_UPLOAD_CHUNK_BYTES / 3) * 4;

    expect(base64Bytes).toBeLessThan(2 * 1024 * 1024);
  });

  it("includes every field required by the X Chat append schema", () => {
    expect(
      buildXChatMediaUploadAppendRequest(
        "1:2",
        "media-hash",
        new Uint8Array([1, 2, 3]),
        4
      )
    ).toEqual({
      conversationId: "1:2",
      media: "AQID",
      mediaHashKey: "media-hash",
      segmentIndex: 4,
    });
  });
});
