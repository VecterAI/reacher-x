import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import {
  captureClientErrorMessage,
  extractConvexErrorData,
  getClientErrorMessage,
  getConvexErrorCode,
  getConvexErrorMessage,
  looksLikeInternalErrorMessage,
} from "./errors";
import { createAppError, throwAppError } from "../../convex/lib/appError";
import { getUserSafeErrorMessage } from "../../convex/lib/errorHelpers";

describe("shared/lib/errors", () => {
  it("unwraps string ConvexError messages", () => {
    const error = new ConvexError(
      "Wait for Agent to finish before continuing."
    );
    expect(getConvexErrorMessage(error)).toBe(
      "Wait for Agent to finish before continuing."
    );
    expect(getConvexErrorCode(error)).toBeUndefined();
    expect(getClientErrorMessage(error, "Fallback")).toBe(
      "Wait for Agent to finish before continuing."
    );
  });

  it("unwraps structured ConvexError payloads created by throwAppError", () => {
    let caught: unknown;
    try {
      throwAppError(
        "ACCOUNT_NOT_CONNECTED",
        "Connect LinkedIn in Settings before continuing."
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConvexError);
    expect(extractConvexErrorData(caught)).toEqual({
      code: "ACCOUNT_NOT_CONNECTED",
      message: "Connect LinkedIn in Settings before continuing.",
    });
    expect(getConvexErrorCode(caught)).toBe("ACCOUNT_NOT_CONNECTED");
    expect(getClientErrorMessage(caught, "Fallback")).toBe(
      "Connect LinkedIn in Settings before continuing."
    );
  });

  it("unwraps cross-realm ConvexError objects marked with the ConvexError symbol", () => {
    const crossRealmError = {
      [Symbol.for("ConvexError")]: true,
      name: "ConvexError",
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: "You have reached your workspace limit.",
      },
    };

    expect(getClientErrorMessage(crossRealmError, "Fallback")).toBe(
      "You have reached your workspace limit."
    );
    expect(getConvexErrorCode(crossRealmError)).toBe("PLAN_LIMIT_REACHED");
  });

  it("hides raw Convex and third-party provider errors behind the fallback", () => {
    const rawDevConvexError = new Error(
      "[CONVEX A(linkedin:getLinkedInProfile)] [Request ID: 7fa92e41e55861d4] Server Error Uncaught Error: fetchinio.linkedin.user.profile would cost ~$0.0015 on treg's fetchinio key and this team's balance is $0 at handler (../convex/linkedin.ts:3582:22) Called by client"
    );
    const rawProdConvexError = new Error(
      "[CONVEX Q(usage:getUsage)] [Request ID: abc123] Server Error Called by client"
    );

    expect(
      getClientErrorMessage(
        rawDevConvexError,
        "We couldn't load this profile right now. Please try again."
      )
    ).toBe("We couldn't load this profile right now. Please try again.");

    expect(getClientErrorMessage(rawProdConvexError, "Please try again.")).toBe(
      "Please try again."
    );
  });

  it("rejects accidental internal wrappers even inside a ConvexError", () => {
    const leakedWrapper = new ConvexError(
      "[CONVEX A(x:send)] Server Error Uncaught Error: boom Called by client"
    );
    const leakedJson = new ConvexError(
      '{"error":"internal_failure","code":500}'
    );

    expect(looksLikeInternalErrorMessage(String(leakedWrapper.data))).toBe(
      true
    );
    expect(getClientErrorMessage(leakedWrapper, "Please try again.")).toBe(
      "Please try again."
    );
    expect(getClientErrorMessage(leakedJson, "Please try again.")).toBe(
      "Please try again."
    );
  });

  it("returns fallback for non-Error values", () => {
    expect(getClientErrorMessage(null, "Fallback")).toBe("Fallback");
    expect(getClientErrorMessage(undefined, "Fallback")).toBe("Fallback");
    expect(getClientErrorMessage("raw string error", "Fallback")).toBe(
      "Fallback"
    );
    expect(getClientErrorMessage({ message: "not convex" }, "Fallback")).toBe(
      "Fallback"
    );
  });

  it("logs raw errors and returns fallback in captureClientErrorMessage", () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const raw = new Error("ECONNREFUSED 127.0.0.1:5432");
      expect(
        captureClientErrorMessage(raw, "Please try again.", "TestScope")
      ).toBe("Please try again.");
      expect(consoleSpy).toHaveBeenCalledTimes(1);

      consoleSpy.mockClear();
      const appError = createAppError(
        "INVALID_INPUT",
        "Shorten your message and try again."
      );
      expect(
        captureClientErrorMessage(appError, "Please try again.", "TestScope")
      ).toBe("Shorten your message and try again.");
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("keeps convex/lib/errorHelpers getUserSafeErrorMessage safe", () => {
    const rawProviderError = new Error(
      "Insufficient credits. Add more using https://openrouter.ai/settings/credits"
    );
    expect(
      getUserSafeErrorMessage(rawProviderError, "Could not finish this plan.")
    ).toBe("Could not finish this plan.");

    const appError = createAppError(
      "CONFLICT",
      "This plan is no longer available."
    );
    expect(
      getUserSafeErrorMessage(appError, "Could not finish this plan.")
    ).toBe("This plan is no longer available.");
  });
});
