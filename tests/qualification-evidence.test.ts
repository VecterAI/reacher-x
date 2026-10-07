import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQualificationVerification,
  buildVerifiedQualificationSources,
  isUsableQualificationVerification,
  passesQualificationGate,
  prepareQualificationCandidates,
} from "../convex/lib/qualificationEvidenceCore";

const VERIFIED_AT = 1_789_398_000_000;

function createTwitterReply(authorId = "prospect-1") {
  return {
    platform: "twitter",
    ref: {
      platform: "twitter",
      postId: "tweet-1",
      authorId,
    },
    url: "https://x.com/prospect/status/tweet-1",
    textPreview: "Our team is actively replacing manual lead research.",
    createdAt: VERIFIED_AT,
    inReplyToPostId: "root-tweet",
  };
}

test("rejects a post when its author does not match the prospect", () => {
  const candidates = prepareQualificationCandidates({
    platform: "twitter",
    evidencePosts: [createTwitterReply("someone-else")],
    profileData: { id_str: "prospect-1" },
    discoveryQueries: ["manual lead research"],
  });

  assert.deepEqual(candidates, []);
});

test("rejects a source URL that does not match the claimed platform", () => {
  const candidates = prepareQualificationCandidates({
    platform: "twitter",
    evidencePosts: [
      { ...createTwitterReply(), url: "https://example.com/tweet-1" },
    ],
    profileData: { id_str: "prospect-1" },
    discoveryQueries: ["manual lead research"],
  });

  assert.deepEqual(candidates, []);
});

test("accepts a prospect-authored X reply as a candidate source", () => {
  const candidates = prepareQualificationCandidates({
    platform: "twitter",
    evidencePosts: [createTwitterReply()],
    profileData: { id_str: "prospect-1" },
    discoveryQueries: ["manual lead research", "manual lead research"],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.contentType, "reply");
  assert.deepEqual(candidates[0]?.discoveryQueries, ["manual lead research"]);
});

test("accepts a LinkedIn post only when its author URN matches", () => {
  const candidates = prepareQualificationCandidates({
    platform: "linkedin",
    evidencePosts: [
      {
        id: "linkedin-post-1",
        platform: "linkedin",
        url: "https://www.linkedin.com/posts/prospect_linkedin-post-1",
        text: "We are evaluating better outbound research workflows.",
        author: { urn: "urn:li:fsd_profile:prospect-1" },
      },
    ],
    profileData: { urn: "urn:li:fsd_profile:prospect-1" },
    discoveryQueries: ["outbound research"],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.contentType, "post");
  assert.equal(candidates[0]?.authorId, "urn:li:fsd_profile:prospect-1");
});

test("derives the canonical X status URL for tweets stored without a URL", () => {
  const candidates = prepareQualificationCandidates({
    platform: "twitter",
    evidencePosts: [
      {
        id_str: "123",
        full_text: "Our team is actively replacing manual lead research.",
        created_at: "Sat Jul 12 12:00:00 +0000 2026",
        user: { id_str: "prospect-1", screen_name: "prospect" },
      },
    ],
    profileData: { id_str: "prospect-1" },
    discoveryQueries: ["manual lead research"],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.sourceId, "123");
  assert.equal(candidates[0]?.sourceUrl, "https://x.com/prospect/status/123");
});

test("derives the canonical /i/ status URL when a stored tweet has no handle", () => {
  const candidates = prepareQualificationCandidates({
    platform: "twitter",
    evidencePosts: [
      {
        id_str: "123",
        full_text: "Our team is actively replacing manual lead research.",
        user: { id_str: "prospect-1" },
      },
    ],
    profileData: { id_str: "prospect-1" },
    discoveryQueries: ["manual lead research"],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.sourceUrl, "https://x.com/i/status/123");
});

test("keeps rejecting a LinkedIn post without a stored URL", () => {
  const candidates = prepareQualificationCandidates({
    platform: "linkedin",
    evidencePosts: [
      {
        id: "linkedin-post-1",
        platform: "linkedin",
        text: "We are evaluating better outbound research workflows.",
        author: { urn: "urn:li:fsd_profile:prospect-1" },
      },
    ],
    profileData: { urn: "urn:li:fsd_profile:prospect-1" },
    discoveryQueries: ["outbound research"],
  });

  assert.deepEqual(candidates, []);
});

test("keeps rejecting a LinkedIn post even when it carries a stray tweet id_str", () => {
  const candidates = prepareQualificationCandidates({
    platform: "linkedin",
    evidencePosts: [
      {
        id: "linkedin-post-1",
        platform: "linkedin",
        id_str: "123",
        full_text: "We are evaluating better outbound research workflows.",
        user: { screen_name: "prospect" },
        author: { urn: "urn:li:fsd_profile:prospect-1" },
      },
    ],
    profileData: { urn: "urn:li:fsd_profile:prospect-1" },
    discoveryQueries: ["outbound research"],
  });

  assert.deepEqual(candidates, []);
});

test("prefers a stored post URL over the derived X permalink", () => {
  const candidates = prepareQualificationCandidates({
    platform: "twitter",
    evidencePosts: [
      {
        id_str: "123",
        full_text: "Our team is actively replacing manual lead research.",
        url: "https://x.com/prospect/status/999",
        user: { id_str: "prospect-1", screen_name: "prospect" },
      },
    ],
    profileData: { id_str: "prospect-1" },
    discoveryQueries: ["manual lead research"],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.sourceUrl, "https://x.com/prospect/status/999");
});

test("rejects an invented supporting quote", () => {
  const candidates = prepareQualificationCandidates({
    platform: "twitter",
    evidencePosts: [createTwitterReply()],
    profileData: { id_str: "prospect-1" },
    discoveryQueries: ["manual lead research"],
  });
  const sources = buildVerifiedQualificationSources({
    candidates,
    decisions: [
      {
        candidateId: "social:twitter:tweet-1",
        supportsQualification: true,
        supportingQuote: "We urgently need ReacherX today.",
      },
    ],
    verifiedAt: VERIFIED_AT,
  });

  assert.deepEqual(sources, []);
});

test("persists a source only when the supporting quote exists verbatim", () => {
  const candidates = prepareQualificationCandidates({
    platform: "twitter",
    evidencePosts: [createTwitterReply()],
    profileData: { id_str: "prospect-1" },
    discoveryQueries: ["manual lead research"],
  });
  const sources = buildVerifiedQualificationSources({
    candidates,
    decisions: [
      {
        candidateId: "social:twitter:tweet-1",
        supportsQualification: true,
        supportingQuote: "actively replacing manual lead research",
      },
    ],
    verifiedAt: VERIFIED_AT,
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.sourceUrl, "https://x.com/prospect/status/tweet-1");
  assert.equal(sources[0]?.contentType, "reply");
});

test("accepts linked article text only when URL and author match", () => {
  const post = {
    ...createTwitterReply(),
    externalUrls: ["https://prospect.example.com/outbound-research"],
  };
  const candidates = prepareQualificationCandidates({
    platform: "twitter",
    evidencePosts: [post],
    profileData: { id_str: "prospect-1", name: "Alex Morgan" },
    discoveryQueries: ["outbound research"],
    externalArticles: [
      {
        sourcePostId: "tweet-1",
        url: "https://prospect.example.com/outbound-research",
        author: "Alex Morgan",
        text: "Our outbound researchers lose hours to manual verification.",
      },
      {
        sourcePostId: "tweet-1",
        url: "https://unlinked.example.com/article",
        author: "Alex Morgan",
        text: "This URL was never present in the post.",
      },
      {
        sourcePostId: "tweet-1",
        url: "https://prospect.example.com/outbound-research",
        author: "Someone Else",
        text: "The byline does not match the prospect.",
      },
    ],
  });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[1]?.evidenceKind, "external_article");
  assert.equal(
    candidates[1]?.evidenceUrl,
    "https://prospect.example.com/outbound-research"
  );
});

test("enforces threshold, bot, and verified-source requirements in code", () => {
  assert.equal(
    passesQualificationGate({
      modelQualified: true,
      isLikelyBot: false,
      score: 69,
      threshold: 70,
      verifiedSourceCount: 1,
    }),
    false
  );
  assert.equal(
    passesQualificationGate({
      modelQualified: true,
      isLikelyBot: false,
      score: 95,
      threshold: 70,
      verifiedSourceCount: 0,
    }),
    false
  );
  assert.equal(
    passesQualificationGate({
      modelQualified: true,
      isLikelyBot: false,
      score: 70,
      threshold: 70,
      verifiedSourceCount: 1,
    }),
    true
  );
});

test("blocks learning when evidence validation failed or had no candidates", () => {
  const failed = buildQualificationVerification({
    status: "failed",
    candidates: [],
    sources: [],
    discoveryQueries: ["lead gen"],
    validatedAt: VERIFIED_AT,
  });
  const noCandidates = buildQualificationVerification({
    status: "validated",
    candidates: [],
    sources: [],
    discoveryQueries: ["lead gen"],
    validatedAt: VERIFIED_AT,
  });

  assert.equal(isUsableQualificationVerification(failed), false);
  assert.equal(isUsableQualificationVerification(noCandidates), false);
});
