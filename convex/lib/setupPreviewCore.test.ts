import { describe, expect, test } from "vitest";
import { resolveSetupPreviewWorkflowSemanticFailure } from "./setupPreviewCore";

describe("setup preview workflow semantic failures", () => {
  test("maps missing targeting signals to an explicit retryable setup error", () => {
    expect(
      resolveSetupPreviewWorkflowSemanticFailure({
        status: "error",
        reason: "missing_synthetic_posts",
      })
    ).toEqual({
      retryable: true,
      errorCode: "preview_missing_targeting_signals",
      errorMessage: expect.stringContaining("Approve the profiles again"),
    });
  });

  test("maps a missing preview workspace to a terminal setup error", () => {
    expect(
      resolveSetupPreviewWorkflowSemanticFailure({
        status: "error",
        reason: "workspace_missing",
      })
    ).toEqual({
      retryable: false,
      errorCode: "preview_workspace_missing",
      errorMessage: expect.stringContaining("Start a new setup draft"),
    });
  });

  test("ignores successful workflow results", () => {
    expect(
      resolveSetupPreviewWorkflowSemanticFailure({ status: "completed" })
    ).toBeNull();
  });
});
