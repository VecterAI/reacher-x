import type { Infer } from "convex/values";
import type {
  qualificationSourceValidator,
  qualificationVerificationValidator,
} from "../validators";
import {
  getWorkflowEvidencePostCreatedAt,
  getWorkflowEvidencePostId,
  getWorkflowEvidencePostText,
  getWorkflowEvidencePostUrl,
  sanitizeWorkflowString,
  sanitizeProspectEvidencePostsForWorkflow,
} from "./workflowSafeProspect";

/** Hydrate only selected source IDs; never add unrelated posts to an evaluation. */
export function hydrateQualificationEvidence(args: {
  selectedPosts: Array<Record<string, unknown>>;
  storedPosts: Array<Record<string, unknown>>;
}): Array<Record<string, unknown>> {
  const storedById = new Map(
    args.storedPosts.flatMap((post) => {
      const id = getWorkflowEvidencePostId(post);
      return id ? [[id, post] as const] : [];
    })
  );
  return args.selectedPosts.map((post) => {
    // Already-full snapshots (including audit inputs) remain authoritative.
    if (typeof post.full_text === "string" || typeof post.text === "string")
      return post;
    const id = getWorkflowEvidencePostId(post);
    const stored = id ? storedById.get(id) : undefined;
    const fullText = stored ? getWorkflowEvidencePostText(stored) : "";
    return fullText
      ? { ...post, full_text: sanitizeWorkflowString(fullText) }
      : post;
  });
}

export type QualificationSource = Infer<typeof qualificationSourceValidator>;

/**
 * Full X text is evaluated in the action, not carried repeatedly in its journal.
 * Keep ordinary sources intact. For oversized source bundles, retain verified
 * quotes and native post references; the profile UI resolves the original full
 * post from the prospect's evidencePosts by sourceId. This does not truncate
 * anything before model evaluation or remove the original persisted evidence.
 */
export function compactQualificationSourcesForWorkflow(
  sources: QualificationSource[]
): QualificationSource[] {
  const serializedBytes = new TextEncoder().encode(
    JSON.stringify(sources)
  ).length;
  if (serializedBytes <= 128 * 1024) return sources;
  return sources.map((source) =>
    source.platform === "twitter"
      ? {
          ...source,
          text: source.supportingQuote,
          sourcePost: sanitizeProspectEvidencePostsForWorkflow(
            [source.sourcePost],
            "twitter"
          )[0] ?? {
            id_str: source.sourceId,
            full_text: source.supportingQuote,
          },
        }
      : source
  );
}
export type QualificationVerification = Infer<
  typeof qualificationVerificationValidator
>;

export type QualificationEvidenceDecision = {
  candidateId: string;
  supportsQualification: boolean;
  supportingQuote: string;
};

export type QualificationExternalArticle = {
  sourcePostId: string;
  url: string;
  author: string;
  text: string;
};

export type QualificationCandidate = {
  candidateId: string;
  evidenceKind: "social_content" | "external_article";
  platform: "twitter" | "linkedin";
  contentType: "post" | "reply" | "quote_post";
  sourceId: string;
  sourceUrl: string;
  evidenceUrl?: string;
  authorId: string;
  text: string;
  publishedAt?: string;
  discoveryQueries: string[];
  sourcePost: Record<string, unknown>;
};

/** A model-interpreted conflict is actionable only when grounded in a real source. */
export function hasVerifiedGoalConflict(
  candidates: QualificationCandidate[],
  assessment: {
    verdict: "compatible" | "unknown" | "contradicted";
    candidateId: string;
    conflictingQuote: string;
  }
): boolean {
  if (
    assessment.verdict !== "contradicted" ||
    !assessment.conflictingQuote.trim()
  )
    return false;
  return candidates.some(
    (candidate) =>
      candidate.candidateId === assessment.candidateId &&
      candidate.text.includes(assessment.conflictingQuote.trim())
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getProfileAuthorIds(
  profileData: Record<string, unknown>
): Set<string> {
  return new Set(
    [
      getString(profileData.id_str),
      getString(profileData.id),
      getString(profileData.urn),
      getString(profileData.profileID),
    ].filter((value): value is string => Boolean(value))
  );
}

function normalizePersonName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^by\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getProfileAuthorNames(
  profileData: Record<string, unknown>
): Set<string> {
  const combinedName = [
    getString(profileData.firstName),
    getString(profileData.lastName),
  ]
    .filter(Boolean)
    .join(" ");

  return new Set(
    [getString(profileData.name), combinedName]
      .filter((value): value is string => Boolean(value))
      .map(normalizePersonName)
      .filter(Boolean)
  );
}

function getPostExternalUrls(post: Record<string, unknown>): string[] {
  return Array.isArray(post.externalUrls)
    ? dedupeStrings(
        post.externalUrls.filter(
          (value): value is string => typeof value === "string"
        )
      )
    : [];
}

function isValidSourceUrl(
  platform: "twitter" | "linkedin",
  sourceUrl: string
): boolean {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (platform === "twitter") {
      return (
        (hostname === "x.com" || hostname === "twitter.com") &&
        parsed.pathname.includes("/status/")
      );
    }

    return (
      (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) &&
      (parsed.pathname.includes("/posts/") ||
        parsed.pathname.includes("/feed/update/"))
    );
  } catch {
    return false;
  }
}

function getPostAuthorIds(post: Record<string, unknown>): string[] {
  const ref = isRecord(post.ref) ? post.ref : undefined;
  const author = isRecord(post.author) ? post.author : undefined;
  const user = isRecord(post.user) ? post.user : undefined;

  return dedupeStrings(
    [
      getString(ref?.authorId),
      getString(author?.id),
      getString(author?.urn),
      getString(author?.profileID),
      getString(user?.id_str),
      getString(user?.id),
    ].filter((value): value is string => Boolean(value))
  );
}

function getContentType(
  platform: "twitter" | "linkedin",
  post: Record<string, unknown>
): QualificationCandidate["contentType"] {
  if (platform === "linkedin") {
    return "post";
  }
  if (getString(post.inReplyToPostId)) {
    return "reply";
  }
  if (getString(post.quotePostId)) {
    return "quote_post";
  }
  return "post";
}

/**
 * Converts provider results into proof candidates. A candidate exists only when
 * its persisted text, stable ID, URL, and author all agree with the prospect.
 */
export function prepareQualificationCandidates(args: {
  platform: "twitter" | "linkedin";
  evidencePosts: Array<Record<string, unknown>>;
  profileData: Record<string, unknown>;
  discoveryQueries: string[];
  externalArticles?: QualificationExternalArticle[];
}): QualificationCandidate[] {
  const profileAuthorIds = getProfileAuthorIds(args.profileData);
  if (profileAuthorIds.size === 0) {
    return [];
  }

  const discoveryQueries = dedupeStrings(args.discoveryQueries);
  const seen = new Set<string>();
  const candidates: QualificationCandidate[] = [];

  for (const post of args.evidencePosts) {
    const sourceId = getWorkflowEvidencePostId(post);
    const sourceUrl = getWorkflowEvidencePostUrl(post);
    const text = getWorkflowEvidencePostText(post).trim();
    const authorId = getPostAuthorIds(post).find((id) =>
      profileAuthorIds.has(id)
    );

    if (
      !sourceId ||
      !sourceUrl ||
      !isValidSourceUrl(args.platform, sourceUrl) ||
      !text ||
      !authorId
    ) {
      continue;
    }

    const sourceKey = `${args.platform}:${sourceId}`;
    if (seen.has(sourceKey)) {
      continue;
    }
    seen.add(sourceKey);

    candidates.push({
      candidateId: `social:${args.platform}:${sourceId}`,
      evidenceKind: "social_content",
      platform: args.platform,
      contentType: getContentType(args.platform, post),
      sourceId,
      sourceUrl,
      authorId,
      text,
      publishedAt: getWorkflowEvidencePostCreatedAt(post),
      discoveryQueries,
      sourcePost: post,
    });
  }

  const profileAuthorNames = getProfileAuthorNames(args.profileData);
  if (profileAuthorNames.size === 0) {
    return candidates;
  }

  const socialCandidatesById = new Map(
    candidates.map((candidate) => [candidate.sourceId, candidate])
  );
  for (const article of args.externalArticles ?? []) {
    const socialCandidate = socialCandidatesById.get(article.sourcePostId);
    const normalizedArticleAuthor = normalizePersonName(article.author);
    if (
      !socialCandidate ||
      !article.text.trim() ||
      !profileAuthorNames.has(normalizedArticleAuthor) ||
      !getPostExternalUrls(socialCandidate.sourcePost).includes(article.url)
    ) {
      continue;
    }

    candidates.push({
      ...socialCandidate,
      candidateId: `article:${args.platform}:${article.sourcePostId}:${article.url}`,
      evidenceKind: "external_article",
      evidenceUrl: article.url,
      text: article.text.trim(),
    });
  }

  return candidates;
}

/**
 * Accepts semantic decisions only when the quoted text exists verbatim in the
 * persisted candidate. Unsupported, missing, invented, or mismatched quotes
 * are rejected in code.
 */
export function buildVerifiedQualificationSources(args: {
  candidates: QualificationCandidate[];
  decisions: QualificationEvidenceDecision[];
  verifiedAt: number;
}): QualificationSource[] {
  const candidatesById = new Map(
    args.candidates.map((candidate) => [candidate.candidateId, candidate])
  );
  const seen = new Set<string>();
  const sources: QualificationSource[] = [];

  for (const decision of args.decisions) {
    if (!decision.supportsQualification || seen.has(decision.candidateId)) {
      continue;
    }

    const candidate = candidatesById.get(decision.candidateId);
    const supportingQuote = decision.supportingQuote.trim();
    if (
      !candidate ||
      !supportingQuote ||
      !candidate.text.includes(supportingQuote)
    ) {
      continue;
    }

    seen.add(decision.candidateId);
    sources.push({
      verificationVersion: 1,
      evidenceKind: candidate.evidenceKind,
      platform: candidate.platform,
      contentType: candidate.contentType,
      sourceId: candidate.sourceId,
      sourceUrl: candidate.sourceUrl,
      evidenceUrl: candidate.evidenceUrl,
      authorId: candidate.authorId,
      text: candidate.text,
      publishedAt: candidate.publishedAt,
      discoveryQueries: candidate.discoveryQueries,
      supportingQuote,
      verifiedAt: args.verifiedAt,
      sourcePost: candidate.sourcePost,
    });
  }

  return sources;
}

export function buildQualificationVerification(args: {
  status: QualificationVerification["status"];
  candidates: QualificationCandidate[];
  sources: QualificationSource[];
  discoveryQueries: string[];
  validatedAt: number;
}): QualificationVerification {
  return {
    version: 1,
    status: args.status,
    validatedAt: args.validatedAt,
    candidateSourceCount: args.candidates.length,
    supportedSourceCount: args.sources.length,
    discoveryQueries: dedupeStrings(args.discoveryQueries),
  };
}

export function isUsableQualificationVerification(
  verification: QualificationVerification | undefined
): boolean {
  return (
    verification?.status === "validated" &&
    verification.candidateSourceCount > 0
  );
}

export function passesQualificationGate(args: {
  modelQualified: boolean;
  isLikelyBot: boolean;
  score: number;
  threshold: number;
  verifiedSourceCount: number;
}): boolean {
  return (
    args.modelQualified &&
    !args.isLikelyBot &&
    args.score >= args.threshold &&
    args.verifiedSourceCount > 0
  );
}
