import { describe, expect, test } from "vitest";
import {
  hydrateQualificationEvidence,
  hasVerifiedGoalConflict,
  prepareQualificationCandidates,
  buildVerifiedQualificationSources,
  compactQualificationSourcesForWorkflow,
} from "./qualificationEvidenceCore";
import {
  sanitizeProspectEvidencePostsForWorkflow,
  getWorkflowEvidencePostText,
} from "./workflowSafeProspect";

describe("full X qualification evidence outside workflow journals", () => {
  test("large hydrated source bundles retain exact proof without overflowing a workflow result", () => {
    const fullText = `${"😀日本語".repeat(4000)} I am hiring engineers now.`;
    const posts = Array.from({ length: 20 }, (_, index) => ({
      id_str: String(index + 1),
      url: `https://x.com/author/status/${index + 1}`,
      full_text: fullText,
      user: { id_str: "42", screen_name: "author" },
    }));
    const candidates = prepareQualificationCandidates({
      platform: "twitter",
      profileData: { id_str: "42" },
      evidencePosts: posts,
      discoveryQueries: [],
    });
    expect(candidates).toHaveLength(20);
    expect(candidates.every((c) => c.text === fullText)).toBe(true);
    const sources = buildVerifiedQualificationSources({
      candidates,
      decisions: candidates.map((c) => ({
        candidateId: c.candidateId,
        supportsQualification: true,
        supportingQuote: "I am hiring engineers now.",
      })),
      verifiedAt: 1,
    });
    expect(
      new TextEncoder().encode(JSON.stringify(sources)).length
    ).toBeGreaterThan(1024 * 1024);
    const compact = compactQualificationSourcesForWorkflow(sources);
    expect(compact).toHaveLength(20);
    expect(
      new TextEncoder().encode(JSON.stringify(compact)).length
    ).toBeLessThan(128 * 1024);
    expect(compact.map((s) => s.sourceId)).toEqual(
      sources.map((s) => s.sourceId)
    );
    expect(compact.every((s) => s.text === s.supportingQuote)).toBe(true);
    expect(sources[0].text).toBe(fullText);
    expect(compactQualificationSourcesForWorkflow(compact)).toBe(compact);
  });
  test("goal conflicts require a model decision and real source quote, never a word list", () => {
    const text = "No agencies, please. Applications from engineers welcome.";
    const posts = sanitizeProspectEvidencePostsForWorkflow(
      [
        {
          id_str: "123",
          full_text: text,
          user: { id_str: "42", screen_name: "author" },
        },
      ],
      "twitter"
    );
    const candidates = prepareQualificationCandidates({
      platform: "twitter",
      profileData: { id_str: "42" },
      evidencePosts: posts,
      discoveryQueries: [],
    });
    expect(candidates).toHaveLength(1);
    const assessment = {
      verdict: "contradicted" as const,
      candidateId: candidates[0].candidateId,
      conflictingQuote: "No agencies, please.",
    };
    expect(hasVerifiedGoalConflict(candidates, assessment)).toBe(true);
    // The very same post is compatible when the user wants to apply for a job.
    expect(
      hasVerifiedGoalConflict(candidates, {
        ...assessment,
        verdict: "compatible",
      })
    ).toBe(false);
    expect(
      hasVerifiedGoalConflict(candidates, { ...assessment, verdict: "unknown" })
    ).toBe(false);
    expect(
      hasVerifiedGoalConflict(candidates, {
        ...assessment,
        candidateId: "invented",
      })
    ).toBe(false);
    expect(
      hasVerifiedGoalConflict(candidates, {
        ...assessment,
        conflictingQuote: "Invented refusal",
      })
    ).toBe(false);
    expect(
      hasVerifiedGoalConflict(candidates, {
        ...assessment,
        conflictingQuote: " ",
      })
    ).toBe(false);
  });
  test("retains the complete tail and canonical source identity, without expanding workflow previews", () => {
    const fullText = `${"a".repeat(278)}😀 ${"details ".repeat(80)}Decisive evidence at the end. العربية`;
    const stored = {
      id_str: "123456789",
      full_text: fullText,
      user: { id_str: "42", screen_name: "author" },
    };
    const selected = sanitizeProspectEvidencePostsForWorkflow(
      [stored],
      "twitter"
    );
    expect(getWorkflowEvidencePostText(selected[0]).length).toBeLessThanOrEqual(
      280
    );
    const hydrated = hydrateQualificationEvidence({
      selectedPosts: selected,
      storedPosts: [stored, { id_str: "other", full_text: "Unrelated" }],
    });
    expect(hydrated).toHaveLength(1);
    expect(getWorkflowEvidencePostText(hydrated[0])).toBe(fullText);
    expect(hydrated[0].url).toBe(selected[0].url);
    expect(hydrated[0].ref).toEqual(selected[0].ref);
    expect(selected[0].full_text).toBeUndefined();
  });
  test("preserves full audit snapshots and missing-source inputs", () => {
    const snapshot = { id_str: "1", full_text: "Original snapshot" };
    const missing = {
      ref: { postId: "2" },
      textPreview: "Missing stored post",
    };
    expect(
      hydrateQualificationEvidence({
        selectedPosts: [snapshot, missing],
        storedPosts: [{ id_str: "1", full_text: "Later edit" }],
      })
    ).toEqual([snapshot, missing]);
  });
  test("repairs malformed Unicode without dropping a long tail", () => {
    const selected = sanitizeProspectEvidencePostsForWorkflow(
      [{ id_str: "1", full_text: "preview" }],
      "twitter"
    );
    const [post] = hydrateQualificationEvidence({
      selectedPosts: selected,
      storedPosts: [{ id_str: "1", full_text: "bad\ud800 but valid 😀 tail" }],
    });
    expect(post.full_text).toBe("bad� but valid 😀 tail");
  });
});
