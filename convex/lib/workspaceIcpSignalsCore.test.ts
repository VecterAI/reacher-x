import { describe, expect, test } from "vitest";
import {
  invalidateWorkspaceIcpGeneratedSignals,
  reconcileWorkspaceIcpUpdate,
  restoreWorkspaceIcpSignalsFromReference,
  summarizeWorkspaceIcpSignalRefresh,
  type WorkspaceIcp,
} from "./workspaceIcpSignalsCore";

import { syntheticExamples } from "../../test/syntheticProfiles";

const savedProfile: WorkspaceIcp = {
  syntheticExamples,
  title: "Technical founders",
  description: "Founders building developer infrastructure.",
  painPoints: ["Reaching technical buyers", "Long sales cycles"],
  channels: ["X/Twitter", "LinkedIn"],
  syntheticPosts: ["I need a better way to reach technical buyers."],
  qualificationKeywords: ["developer infrastructure"],
};

describe("workspace ICP signal reconciliation", () => {
  test("preserves generated signals for a materially unchanged profile", () => {
    const incoming = {
      title: " Technical founders ",
      description: "Founders building developer infrastructure.",
      painPoints: ["Long sales cycles", "Reaching technical buyers"],
      channels: ["LinkedIn", "X"],
    };

    const result = reconcileWorkspaceIcpUpdate({
      existingIcps: [savedProfile],
      incomingIcps: [incoming],
    });

    expect(result.regenerationIndices).toEqual([]);
    expect(result.nextIcps[0]).toMatchObject({
      syntheticPosts: savedProfile.syntheticPosts,
      qualificationKeywords: savedProfile.qualificationKeywords,
    });
  });

  test.each([
    ["title", { title: "Infrastructure founders" }],
    ["description", { description: "Founders building data infrastructure." }],
    ["pain points", { painPoints: ["Hiring sales engineers"] }],
    ["channels", { channels: ["LinkedIn"] }],
  ])("invalidates generated signals when %s change", (_label, change) => {
    const result = reconcileWorkspaceIcpUpdate({
      existingIcps: [savedProfile],
      incomingIcps: [{ ...savedProfile, ...change }],
    });

    expect(result.regenerationIndices).toEqual([0]);
    expect(result.nextIcps[0]?.syntheticPosts).toBeUndefined();
    expect(result.nextIcps[0]?.qualificationKeywords).toBeUndefined();
  });

  test("invalidates every profile when workspace targeting context changes", () => {
    const invalidated = invalidateWorkspaceIcpGeneratedSignals([
      savedProfile,
      { ...savedProfile, title: "Revenue leaders" },
    ]);

    expect(invalidated).toHaveLength(2);
    for (const profile of invalidated) {
      expect(profile.syntheticPosts).toBeUndefined();
      expect(profile.qualificationKeywords).toBeUndefined();
    }
  });

  test("does not restore explicitly invalidated profiles from setup references", () => {
    const invalidated = invalidateWorkspaceIcpGeneratedSignals([savedProfile]);
    const result = restoreWorkspaceIcpSignalsFromReference({
      icps: invalidated,
      referenceIcps: [savedProfile],
      excludedIndices: [0],
    });

    expect(result.restoredIndices).toEqual([]);
    expect(result.nextIcps[0]?.syntheticPosts).toBeUndefined();
  });

  test("keeps the refresh issue open when generation failed despite stale signals", () => {
    const summary = summarizeWorkspaceIcpSignalRefresh({
      icps: [savedProfile],
      failedIndices: [0],
    });

    expect(summary).toEqual({
      success: false,
      shouldClearSystemIssue: false,
      missingIndices: [],
    });
  });
});
