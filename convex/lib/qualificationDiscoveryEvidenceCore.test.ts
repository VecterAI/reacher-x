import { describe, expect, test, vi } from "vitest";
import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  collectQualificationDiscoveryEvidence,
  getQualificationProfileText,
} from "./qualificationDiscoveryEvidenceCore";
import { prepareQualificationCandidates } from "./qualificationEvidenceCore";

const prospect = {
  _id: "prospect",
  workspaceId: "workspace",
  platform: "linkedin",
  discoverySource: "search_people",
  qualificationStatus: "pending",
  linkedinUsername: "educator",
  linkedinUserUrn: "ACo123",
  data: { username: "educator", urn: "ACo123" },
  evidencePosts: [],
} as unknown as Doc<"prospects">;
const profile = {
  id: 123,
  urn: "ACo123",
  username: "educator",
  headline: "Course creator",
  summary: "I teach software workflows.",
  position: [
    {
      title: "Instructor",
      companyName: "Courses",
      description: "I record step-by-step software tutorials.",
    },
  ],
};
function context() {
  const runQuery = vi
    .fn()
    .mockResolvedValue({ description: "Find educators", icps: [] });
  const runAction = vi
    .fn()
    .mockResolvedValueOnce({ success: true, profile })
    .mockResolvedValueOnce({ posts: [] });
  const runMutation = vi.fn().mockResolvedValue(null);
  return {
    ctx: { runQuery, runAction, runMutation } as unknown as ActionCtx,
    runAction,
    runMutation,
  };
}
describe("people-search qualification evidence acquisition", () => {
  test("does not fetch activity again for social-search results", async () => {
    const mock = context();
    expect(
      await collectQualificationDiscoveryEvidence(mock.ctx, {
        ...prospect,
        discoverySource: "search_post",
      })
    ).toBeNull();
    expect(mock.runAction).not.toHaveBeenCalled();
  });
  test("a successful empty activity lookup still retains real responsibilities and a profile source", async () => {
    const mock = context();
    const result = await collectQualificationDiscoveryEvidence(
      mock.ctx,
      prospect
    );
    expect(result?.evidencePosts).toEqual([]);
    expect(getQualificationProfileText(result!.profileData)).toContain(
      "I record step-by-step software tutorials."
    );
    expect(result?.profileData.url).toBe(
      "https://www.linkedin.com/in/educator"
    );
    expect(mock.runMutation).toHaveBeenCalledOnce();
    expect(mock.runAction.mock.calls[1][1]).toEqual({
      urn: "ACo123",
      maxPosts: 10,
    });
  });
  test("normalizes fetched activity into verifiable stable source identities", async () => {
    const mock = context();
    mock.runAction
      .mockReset()
      .mockResolvedValueOnce({ success: true, profile })
      .mockResolvedValueOnce({
        posts: [
          {
            urn: "urn:li:activity:7501008973442039808",
            text: "I record software tutorials",
            author: { urn: "ACo123" },
          },
        ],
      });
    const result = await collectQualificationDiscoveryEvidence(
      mock.ctx,
      prospect
    );
    const candidates = prepareQualificationCandidates({
      platform: "linkedin",
      profileData: result!.profileData,
      evidencePosts: result!.evidencePosts,
      discoveryQueries: [],
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].sourceId).toBe("urn:li:activity:7501008973442039808");
  });
  test.each(["profile", "activity"])(
    "%s provider failure throws without caching a false negative",
    async (stage) => {
      const mock = context();
      mock.runAction.mockReset();
      if (stage === "activity")
        mock.runAction.mockResolvedValueOnce({ success: true, profile });
      mock.runAction.mockRejectedValueOnce(new Error("Provider rate limited"));
      await expect(
        collectQualificationDiscoveryEvidence(mock.ctx, prospect)
      ).rejects.toThrow("rate limited");
      expect(mock.runMutation).not.toHaveBeenCalled();
    }
  );
  test("profile provider's soft failure also retries", async () => {
    const mock = context();
    mock.runAction
      .mockReset()
      .mockResolvedValueOnce({ success: false, error: "503 unavailable" });
    await expect(
      collectQualificationDiscoveryEvidence(mock.ctx, prospect)
    ).rejects.toThrow("503 unavailable");
    expect(mock.runMutation).not.toHaveBeenCalled();
  });
  test("rejects evidence returned for a different person", async () => {
    const mock = context();
    mock.runAction.mockReset().mockResolvedValueOnce({
      success: true,
      profile: { ...profile, id: 999, urn: "other", username: "other" },
    });
    await expect(
      collectQualificationDiscoveryEvidence(mock.ctx, prospect)
    ).rejects.toThrow("different profile");
    expect(mock.runMutation).not.toHaveBeenCalled();
  });
  test("retry uses the successfully cached evidence without more external requests", async () => {
    const mock = context();
    const result = await collectQualificationDiscoveryEvidence(mock.ctx, {
      ...prospect,
      qualificationProfileData: profile,
      qualificationEvidenceFetchedAt: 1,
    });
    expect(result?.profileData).toEqual(profile);
    expect(mock.runAction).not.toHaveBeenCalled();
  });
  test("a matching username cannot override a conflicting stable profile identity", async () => {
    const mock = context();
    mock.runAction.mockReset().mockResolvedValueOnce({
      success: true,
      profile: { ...profile, id: 999, urn: "ACoOther" },
    });
    await expect(
      collectQualificationDiscoveryEvidence(mock.ctx, prospect)
    ).rejects.toThrow("different profile");
    expect(mock.runAction).toHaveBeenCalledOnce();
    expect(mock.runMutation).not.toHaveBeenCalled();
  });
  test("a matching stable identity allows a renamed username", async () => {
    const mock = context();
    mock.runAction
      .mockReset()
      .mockResolvedValueOnce({
        success: true,
        profile: { ...profile, username: "renamed-educator" },
      })
      .mockResolvedValueOnce({ posts: [] });
    const result = await collectQualificationDiscoveryEvidence(
      mock.ctx,
      prospect
    );
    expect(result?.profileData.url).toBe(
      "https://www.linkedin.com/in/renamed-educator"
    );
    expect(mock.runMutation).toHaveBeenCalledOnce();
  });
  test("username-only seeds can still acquire verified evidence", async () => {
    const mock = context();
    const result = await collectQualificationDiscoveryEvidence(mock.ctx, {
      ...prospect,
      linkedinUserUrn: undefined,
      data: { username: "educator" },
    });
    expect(result?.profileData.urn).toBe("ACo123");
    expect(mock.runMutation).toHaveBeenCalledOnce();
  });
});
