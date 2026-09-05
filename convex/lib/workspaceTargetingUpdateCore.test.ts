import { describe, expect, test } from "vitest";
import type { WorkspaceProfile } from "./workspaceProfileChangeCore";
import {
  buildRegeneratedWorkspaceTargetingPatch,
  mergeRegeneratedWorkspaceProfiles,
  resolveManualProfilesForTargetingUpdate,
  runPostSaveProspectingMaintenance,
} from "./workspaceTargetingUpdateCore";
import { buildLegacyWorkspaceTargetingSpec } from "./targetingSpecCore";

function profile(
  title: string,
  provenance?: WorkspaceProfile["provenance"]
): WorkspaceProfile {
  return {
    title,
    description: `${title} description`,
    painPoints: [`${title} pain`],
    channels: ["LinkedIn"],
    provenance,
    syntheticPosts: [`A realistic post from ${title}.`],
    qualificationKeywords: [`${title} keyword`],
  };
}

describe("workspace targeting updates", () => {
  test("preserves manual profiles and excludes unchanged AI profiles", () => {
    const generated = profile("AI founders", "ai_generated");
    const manual = profile("Hand-picked operators", "manual");

    const resolved = resolveManualProfilesForTargetingUpdate({
      existingProfiles: [generated, manual],
      submittedProfiles: [generated, manual],
    });

    expect(resolved).toEqual([manual]);
  });

  test("turns a manually edited AI profile into a manual profile", () => {
    const generated = profile("AI founders", "ai_generated");
    const edited = {
      ...generated,
      description: "A user-edited founder description",
    };

    const resolved = resolveManualProfilesForTargetingUpdate({
      existingProfiles: [generated],
      submittedProfiles: [edited],
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      title: "AI founders",
      description: "A user-edited founder description",
      provenance: "manual",
    });
    expect(resolved[0]?.syntheticPosts).toBeUndefined();
    expect(resolved[0]?.qualificationKeywords).toBeUndefined();
  });

  test("treats legacy profiles with generated signals as AI-owned", () => {
    const legacyGenerated = profile("Legacy generated");
    const legacyManual = {
      ...profile("Legacy manual"),
      syntheticPosts: undefined,
      qualificationKeywords: undefined,
    };

    const resolved = resolveManualProfilesForTargetingUpdate({
      existingProfiles: [legacyGenerated, legacyManual],
      submittedProfiles: [legacyGenerated, legacyManual],
    });

    expect(resolved.map((item) => item.title)).toEqual(["Legacy manual"]);
  });

  test("merges new AI profiles with preserved manual profiles", () => {
    const manual = profile("Hand-picked operators", "manual");
    const merged = mergeRegeneratedWorkspaceProfiles({
      generatedProfiles: [
        profile("Founder-led teams"),
        profile("Revenue leaders"),
        profile("Technical recruiters"),
      ],
      manualProfiles: [manual],
    });

    expect(merged).toHaveLength(4);
    expect(
      merged.slice(0, 3).every((item) => item.provenance === "ai_generated")
    ).toBe(true);
    expect(merged[3]).toMatchObject({
      title: manual.title,
      provenance: "manual",
    });
  });

  test("keeps manual profiles when generated titles overlap", () => {
    const manual = profile("Revenue leaders", "manual");
    const merged = mergeRegeneratedWorkspaceProfiles({
      generatedProfiles: [
        profile("Founder-led teams"),
        profile("Revenue leaders"),
        profile("Technical recruiters"),
      ],
      manualProfiles: [manual],
    });

    expect(merged.filter((item) => item.title === "Revenue leaders")).toEqual([
      manual,
    ]);
  });

  test("stores the raw description as the editable source of truth", () => {
    const patch = buildRegeneratedWorkspaceTargetingPatch({
      rawUserDescription: "Find doctors who provide free consultations.",
      improvedDescription:
        "Find doctors who publicly offer free consultations to new patients.",
      profiles: [profile("Community doctors", "ai_generated")],
      targetingSpec: buildLegacyWorkspaceTargetingSpec({
        description:
          "Find doctors who publicly offer free consultations to new patients.",
        profiles: [profile("Community doctors", "ai_generated")],
      }),
      useCaseKey: "general_outreach",
      updatedAt: 123,
    });

    expect(patch).toMatchObject({
      rawUserDescription: "Find doctors who provide free consultations.",
      seedDescription: "Find doctors who provide free consultations.",
      description:
        "Find doctors who publicly offer free consultations to new patients.",
      improvedDescription:
        "Find doctors who publicly offer free consultations to new patients.",
      useCaseKey: "general_outreach",
    });
    expect(patch.refineRollbackSnapshot).toBeUndefined();
  });

  test("reports a successful post-save prospecting restart", async () => {
    const result = await runPostSaveProspectingMaintenance({
      stopProspecting: async () => undefined,
      clearKeywords: async () => 21,
      restartProspecting: async () => true,
      onError: () => expect.unreachable("maintenance should not fail"),
    });

    expect(result).toEqual({
      deletedKeywordCount: 21,
      prospectingRestarted: true,
    });
  });

  test("keeps a completed targeting save successful when restart fails", async () => {
    const restartError = new Error("restart unavailable");
    const observedErrors: unknown[] = [];
    const result = await runPostSaveProspectingMaintenance({
      clearKeywords: async () => 21,
      restartProspecting: async () => {
        throw restartError;
      },
      onError: (error) => observedErrors.push(error),
    });

    expect(result).toEqual({
      deletedKeywordCount: 21,
      prospectingRestarted: false,
    });
    expect(observedErrors).toEqual([restartError]);
  });

  test("does not continue maintenance after stopping prospecting fails", async () => {
    const calls: string[] = [];
    const result = await runPostSaveProspectingMaintenance({
      stopProspecting: async () => {
        calls.push("stop");
        throw new Error("stop unavailable");
      },
      clearKeywords: async () => {
        calls.push("clear");
        return 21;
      },
      restartProspecting: async () => {
        calls.push("restart");
        return true;
      },
      onError: () => calls.push("error"),
    });

    expect(result).toEqual({
      deletedKeywordCount: 0,
      prospectingRestarted: false,
    });
    expect(calls).toEqual(["stop", "error"]);
  });
});
