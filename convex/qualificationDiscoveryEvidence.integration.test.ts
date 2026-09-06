/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal, api } from "./_generated/api";
import schema from "./schema";
import { isRecord } from "./lib/typeGuards";
import { getLearningTargetingFingerprint } from "./lib/learningTargetingHelpers";
import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
const modules = import.meta.glob("./**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "evidence-owner",
      email: "qa@example.test",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "QA",
      description: "Screen recording users",
      isDefault: true,
      updatedAt: getCurrentUTCTimestamp(),
    });
    const otherWorkspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Other",
      description: "Other",
      isDefault: false,
      updatedAt: getCurrentUTCTimestamp(),
    });
    const prospectId = await ctx.db.insert("prospects", {
      userId,
      workspaceId,
      platform: "linkedin",
      origin: "workspace_discovery",
      externalId: "author",
      data: {},
      status: "new",
      qualificationStatus: "pending",
      qualificationScore: 0,
      evidencePosts: [{ id: "existing", text: "Preserved discovery evidence" }],
      updatedAt: getCurrentUTCTimestamp(),
    });
    return {
      userId,
      workspaceId,
      otherWorkspaceId,
      prospectId,
      fingerprint: getLearningTargetingFingerprint(
        (await ctx.db.get(workspaceId))!
      ),
    };
  });
  return { t, ...ids };
}
describe("qualification evidence persistence", () => {
  test("merges concurrent discovery evidence and retains ownership boundaries", async () => {
    const { t, workspaceId, otherWorkspaceId, prospectId, fingerprint } =
      await setup();
    const args = {
      prospectId,
      workspaceId,
      expectedTargetingFingerprint: fingerprint,
      profileData: { urn: "author" },
      evidencePosts: [{ id: "new", text: "Fetched activity" }],
    };
    await t.mutation(
      internal.prospects.saveQualificationDiscoveryEvidenceInternal,
      { ...args, workspaceId: otherWorkspaceId }
    );
    expect(
      (await t.run((ctx) => ctx.db.get(prospectId)))?.qualificationProfileData
    ).toBeUndefined();
    await t.mutation(
      internal.prospects.saveQualificationDiscoveryEvidenceInternal,
      { ...args, expectedTargetingFingerprint: "stale" }
    );
    expect(
      (await t.run((ctx) => ctx.db.get(prospectId)))?.qualificationProfileData
    ).toBeUndefined();
    await t.mutation(
      internal.prospects.saveQualificationDiscoveryEvidenceInternal,
      args
    );
    const saved = await t.run((ctx) => ctx.db.get(prospectId));
    expect(saved?.evidencePosts).toHaveLength(2);
    expect(saved?.qualificationStatus).toBe("pending");
    expect(saved?.qualificationScore).toBe(0);
    await t.run((ctx) =>
      ctx.db.patch(prospectId, { qualificationStatus: "qualified" })
    );
    await t.mutation(
      internal.prospects.saveQualificationDiscoveryEvidenceInternal,
      { ...args, profileData: { urn: "changed" } }
    );
    expect(
      (await t.run((ctx) => ctx.db.get(prospectId)))?.qualificationProfileData
    ).toEqual({ urn: "author" });
  });
  test("legacy page and detail show the same evidence-backed explanation without changing scores", async () => {
    const { t, prospectId, workspaceId } = await setup();
    const rationale =
      "Records product tutorials for customers. See https://example.test/tutorial";
    await t.run(async (ctx) => {
      await ctx.db.patch(prospectId, {
        qualificationStatus: "qualified",
        qualificationScore: 91,
        qualificationCriterionResults: [
          {
            criterionId: "use",
            verdict: "matched",
            confidence: 1,
            rationale,
            sourceIds: ["post"],
          },
        ],
      });
      const prospect = (await ctx.db.get(prospectId))!;
      const summary = buildProspectSummaryRecord(prospect);
      await ctx.db.insert("prospectSummaries", {
        ...summary,
        qualificationReasoning: undefined,
      });
    });
    const viewer = t.withIdentity({ subject: "evidence-owner" });
    const page = await viewer.query(api.prospects.getWorkspaceProspects, {
      workspaceId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    const detail = await viewer.query(api.prospects.getProspect, {
      prospectId,
    });
    expect(page.page).toHaveLength(1);
    const row = page.page[0];
    if (!isRecord(row)) throw new Error("Missing summary row");
    expect(row.qualificationReasoning).toBe(rationale);
    expect(detail?.qualificationReasoning).toBe(rationale);
    expect(detail?.qualificationScore).toBe(91);
  });
});
