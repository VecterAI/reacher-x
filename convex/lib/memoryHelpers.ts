const MULTIPLE_WHITESPACE_REGEX = /\s+/g;
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const SMART_QUOTES_REGEX = /[\u2018\u2019\u201A\u201B]/g;
const SMART_DOUBLE_QUOTES_REGEX = /[\u201C\u201D\u201E\u201F]/g;
const DASH_REGEX = /[\u2013\u2014\u2212]/g;

export const WORKSPACE_MEMORY_NAMESPACE_KINDS = [
  "keywords",
  "patterns",
  "lessons",
  "objections",
  "wins",
  "losses",
] as const;

export type WorkspaceMemoryNamespaceKind =
  (typeof WORKSPACE_MEMORY_NAMESPACE_KINDS)[number];

function normalizeUnicodePunctuation(value: string): string {
  return value
    .replace(SMART_QUOTES_REGEX, "'")
    .replace(SMART_DOUBLE_QUOTES_REGEX, '"')
    .replace(DASH_REGEX, "-");
}

/**
 * Conservative canonicalization for stored memory/query identity.
 * We normalize whitespace and punctuation, but avoid semantic rewrites so
 * distinct search phrases do not collapse into the same exact identity.
 */
export function normalizeMemoryText(value: string): string {
  return normalizeUnicodePunctuation(value)
    .normalize("NFKC")
    .replace(ZERO_WIDTH_REGEX, "")
    .trim()
    .replace(MULTIPLE_WHITESPACE_REGEX, " ")
    .toLowerCase();
}

/**
 * Small deterministic hash for exact identity, implemented locally so it works
 * in both Convex query/mutation runtimes and Node actions.
 */
export function createStableHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildCanonicalKey(
  parts: Array<string | null | undefined>
): string {
  return parts
    .filter(
      (part): part is string => typeof part === "string" && part.length > 0
    )
    .join(":");
}

export function buildKeywordCanonicalRecord(args: {
  type: "seed" | "discovered" | "social_query";
  value: string;
}) {
  const canonicalValue = normalizeMemoryText(args.value);
  const canonicalKey = buildCanonicalKey([
    "keyword",
    args.type,
    canonicalValue,
  ]);

  return {
    canonicalValue,
    canonicalKey,
    canonicalHash: createStableHash(canonicalKey),
  };
}

export function buildQueryCandidateCanonicalRecord(args: {
  type: "seed_keyword" | "social_query";
  value: string;
}) {
  const canonicalValue = normalizeMemoryText(args.value);
  const canonicalKey = buildCanonicalKey([
    "query_candidate",
    args.type,
    canonicalValue,
  ]);

  return {
    canonicalValue,
    canonicalKey,
    canonicalHash: createStableHash(canonicalKey),
  };
}

export function mapKeywordTypeToQueryCandidateType(
  keywordType: "seed" | "discovered" | "social_query"
): "seed_keyword" | "social_query" {
  return keywordType === "social_query" ? "social_query" : "seed_keyword";
}

export function getWorkspaceMemoryNamespace(
  workspaceId: string,
  kind: WorkspaceMemoryNamespaceKind
): string {
  return `workspace:${workspaceId}:${kind}`;
}

export function getNamespaceKindForQueryCandidate(): WorkspaceMemoryNamespaceKind {
  return "keywords";
}

export function buildQueryCandidateEmbeddingDocKey(
  workspaceId: string,
  canonicalKey: string
): string {
  return buildCanonicalKey([
    "query_candidate",
    workspaceId,
    createStableHash(canonicalKey),
  ]);
}

export function buildContentHashFromText(value: string): string {
  return createStableHash(value);
}

export function clampUnitInterval(
  value: number | undefined,
  fallback: number
): number {
  const normalized =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(1, Math.max(0, normalized));
}

export function buildQueryCandidateRagText(args: {
  type: string;
  rawValue: string;
  canonicalValue: string;
  sourceTheme?: string;
  status: string;
}) {
  return [
    `Candidate type: ${args.type}`,
    `Status: ${args.status}`,
    `Raw value: ${args.rawValue}`,
    `Canonical value: ${args.canonicalValue}`,
    args.sourceTheme ? `Source theme: ${args.sourceTheme}` : null,
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}

export function buildMemoryWorkflowEventKey(
  parts: Array<string | number | null | undefined>
): string {
  return parts
    .filter(
      (part): part is string | number =>
        typeof part === "string" || typeof part === "number"
    )
    .join(":");
}
