import { describe, expect, it } from "vitest";
import {
  chunkLinkedInItems,
  chunkLinkedInProspectsForSave,
  LINKEDIN_PROSPECT_SAVE_BATCH_SIZE,
  normalizeLinkedInPostQueryStats,
} from "./linkedinSearchHelpers";
import { buildProspectingCycleOutcome } from "./prospectingCycleCore";
import {
  sanitizeProspectDataForWorkflow,
  sanitizeProspectEvidencePostsForWorkflow,
  sanitizeWorkflowString,
  sanitizeWorkflowValue,
} from "./workflowSafeProspect";

describe("LinkedIn prospect persistence", () => {
  it("replaces unpaired Unicode surrogates before data crosses a workflow boundary", () => {
    expect(sanitizeWorkflowString("before\ud800after")).toBe(
      "before\ufffdafter"
    );

    const [post] = sanitizeProspectEvidencePostsForWorkflow(
      [
        {
          postID: "urn:li:activity:1",
          text: "broken\udc00text",
          author: { name: "Person\ud800" },
        },
      ],
      "linkedin"
    );

    expect(post.text).toBe("broken\ufffdtext");
    expect((post.author as { name: string }).name).toBe("Person\ufffd");
    expect(
      sanitizeWorkflowValue({
        nested: ["broken\ud800value"],
        "broken\udc00key": "safe",
      })
    ).toEqual({
      nested: ["broken\ufffdvalue"],
      "broken\ufffdkey": "safe",
    });
  });

  it("projects people-search data into the bounded workflow-safe profile shape", () => {
    const profile = sanitizeProspectDataForWorkflow(
      {
        urn: "urn:li:fsd_profile:1",
        profileID: "profile-1",
        fullName: "Ada Lovelace",
        headline: "Founder",
        location: "New York, United States",
        unexpectedProviderPayload: { large: "ignored" },
      },
      "linkedin"
    );

    expect(profile).toMatchObject({
      urn: "urn:li:fsd_profile:1",
      id: "profile-1",
      name: "Ada Lovelace",
      headline: "Founder",
      geo: { full: "New York, United States" },
    });
    expect(profile).not.toHaveProperty("unexpectedProviderPayload");
  });

  it("splits LinkedIn writes into bounded mutations", () => {
    const prospects = Array.from(
      { length: LINKEDIN_PROSPECT_SAVE_BATCH_SIZE * 2 + 1 },
      (_, index) => index
    );

    expect(
      chunkLinkedInProspectsForSave(prospects).map((batch) => batch.length)
    ).toEqual([
      LINKEDIN_PROSPECT_SAVE_BATCH_SIZE,
      LINKEDIN_PROSPECT_SAVE_BATCH_SIZE,
      1,
    ]);
  });

  it("uses the requested batch size for bounded LinkedIn work", () => {
    expect(chunkLinkedInItems([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });

  it("reports partial saves as an error instead of a successful cycle", () => {
    expect(
      buildProspectingCycleOutcome({
        twitterSaved: 20,
        linkedinSaved: 7,
        failedPlatforms: ["linkedin"],
      })
    ).toEqual({
      status: "error",
      reason: "LinkedIn search failed and will be retried",
      prospectsFound: 27,
      twitterSaved: 20,
      linkedinSaved: 7,
      failedPlatforms: ["linkedin"],
      shouldContinue: true,
    });
  });

  it("removes provider-only fields before query stats reach Convex validators", () => {
    const [stat] = normalizeLinkedInPostQueryStats(
      [
        {
          query: "Founder",
          postsFound: 30,
          success: true,
          searchMode: "plain_relevance",
        },
      ],
      "LinkedIn post results could not be saved"
    );

    expect(stat).toEqual({
      query: "Founder",
      postsFound: 30,
      success: false,
      error: "LinkedIn post results could not be saved",
    });
    expect(stat).not.toHaveProperty("searchMode");
  });
});
