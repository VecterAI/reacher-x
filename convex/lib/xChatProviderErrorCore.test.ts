import { describe, expect, it } from "vitest";
import { parseXChatProviderError } from "./xChatProviderErrorCore";

describe("XChat provider error metadata", () => {
  it("uses X rate-limit reset headers for a deterministic retry time", () => {
    expect(
      parseXChatProviderError({
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({
          "x-rate-limit-reset": "123",
          "x-rate-limit-limit": "15",
          "x-rate-limit-remaining": "0",
        }),
        rawBody: JSON.stringify({ detail: "endpoint quota reached" }),
        now: 1,
      })
    ).toMatchObject({
      code: "rate_limited",
      status: 429,
      retryAt: 123_000,
      limit: 15,
      remaining: 0,
    });
  });

  it("uses Retry-After when X does not return a reset epoch", () => {
    expect(
      parseXChatProviderError({
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({ "retry-after": "30" }),
        rawBody: "",
        now: 5_000,
      }).retryAt
    ).toBe(35_000);
  });

  it("classifies X's project-related 403 as access denied, not cooldown", () => {
    expect(
      parseXChatProviderError({
        status: 403,
        statusText: "Forbidden",
        headers: new Headers({
          "x-rate-limit-reset": "1787219691",
          "x-rate-limit-limit": "40000",
          "x-rate-limit-remaining": "39999",
        }),
        rawBody: JSON.stringify({
          detail:
            "When authenticating requests to the X API v2 endpoints, you must use keys and tokens from a developer App that is attached to a Project.",
        }),
      })
    ).toEqual({
      status: 403,
      code: "xchat_access_denied",
      message:
        "When authenticating requests to the X API v2 endpoints, you must use keys and tokens from a developer App that is attached to a Project.",
      limit: 40000,
      remaining: 39999,
    });
  });
});
