import type { BenchmarkEntity } from "./types";

/**
 * Stable keys for one person or company, strongest first. Profile URLs and
 * company domains identify an entity; a name with its employer is only a
 * possible match and is never used when a stronger key exists.
 */
export type IdentityKey = Readonly<{
  kind: "linkedin" | "x" | "domain" | "name";
  value: string;
}>;

const LINKEDIN_PATH = /^\/(in|company|school)\/([^/?#]+)/i;
const X_HOSTS = new Set(["x.com", "twitter.com", "mobile.twitter.com"]);
const X_RESERVED = new Set([
  "home",
  "i",
  "intent",
  "search",
  "share",
  "hashtag",
]);

function parseUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`
    );
    return { host: url.hostname.toLowerCase().replace(/^www\./, ""), url };
  } catch {
    return null;
  }
}

/** linkedin.com/in/<slug> or /company/<slug>, lowercased and decoded. */
export function linkedinKey(value: string | null) {
  const parsed = parseUrl(value);
  if (!parsed || !/(^|\.)linkedin\.com$/.test(parsed.host)) return null;
  const match = LINKEDIN_PATH.exec(parsed.url.pathname);
  if (!match) return null;
  let slug = match[2];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // Keep the raw slug when it is not valid percent-encoding.
  }
  return `${match[1].toLowerCase()}/${slug.toLowerCase()}`;
}

export function xHandleKey(value: string | null) {
  const parsed = parseUrl(value);
  if (!parsed || !X_HOSTS.has(parsed.host)) return null;
  const handle = parsed.url.pathname.split("/")[1]?.toLowerCase();
  return handle && /^[a-z0-9_]{1,15}$/.test(handle) && !X_RESERVED.has(handle)
    ? handle
    : null;
}

/** A company's registrable host, without scheme, "www." or path. */
export function domainKey(value: string | null) {
  const parsed = parseUrl(value);
  if (!parsed || !parsed.host.includes(".")) return null;
  if (/(^|\.)(linkedin\.com|x\.com|twitter\.com)$/.test(parsed.host))
    return null;
  return parsed.host;
}

const normalizeName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function identityKeys(entity: BenchmarkEntity): IdentityKey[] {
  const keys: IdentityKey[] = [];
  const add = (kind: IdentityKey["kind"], value: string | null) => {
    if (value && !keys.some((key) => key.kind === kind && key.value === value))
      keys.push({ kind, value });
  };
  add("linkedin", linkedinKey(entity.profileUrl));
  add("x", xHandleKey(entity.profileUrl));
  if (entity.prospectType === "organization") {
    add("domain", entity.domain ? domainKey(entity.domain) : null);
    add("domain", domainKey(entity.profileUrl));
  }
  if (keys.length === 0) {
    const affiliation =
      entity.prospectType === "individual" ? entity.employer : null;
    const name = normalizeName(entity.name);
    if (name)
      add(
        "name",
        affiliation ? `${name} @ ${normalizeName(affiliation)}` : name
      );
  }
  return keys;
}

/** The strongest key, used to share cached evidence across tools. */
export function primaryIdentity(entity: BenchmarkEntity) {
  const [key] = identityKeys(entity);
  return key ? `${entity.prospectType}:${key.kind}:${key.value}` : null;
}

export type ToolResult = Readonly<{
  toolId: string;
  resultId: string;
  entity: BenchmarkEntity;
}>;

export type RepeatFlag = Readonly<{
  resultId: string;
  repeatsTools: readonly string[];
  // "possible" when only a name (and employer) matched.
  confidence: "identity" | "possible";
}>;

/**
 * Proposal 5.3 step 3: flag results another tool also returned for the same
 * prompt. Flags are informational; every result is still judged on its own.
 */
export function flagRepeats(results: readonly ToolResult[]): RepeatFlag[] {
  const owners = new Map<string, Set<string>>();
  const keyed = results.map((result) => {
    const identity = identityKeys(result.entity);
    const keys = identity.map(
      (key) => `${result.entity.prospectType}:${key.kind}:${key.value}`
    );
    for (const key of keys)
      owners.set(key, (owners.get(key) ?? new Set()).add(result.toolId));
    return {
      result,
      keys,
      nameOnly: identity.every((key) => key.kind === "name"),
    };
  });
  return keyed.flatMap(({ result, keys, nameOnly }) => {
    const others = new Set<string>();
    for (const key of keys)
      for (const tool of owners.get(key) ?? [])
        if (tool !== result.toolId) others.add(tool);
    if (others.size === 0) return [];
    return [
      {
        resultId: result.resultId,
        repeatsTools: [...others].sort(),
        confidence: nameOnly ? "possible" : "identity",
      },
    ];
  });
}
