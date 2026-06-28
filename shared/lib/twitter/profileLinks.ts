import { detectUrls } from "../utils/url/urlDetection";

export type TwitterUrlEntity = {
  url: string;
  expanded_url: string;
  display_url: string;
  indices: [number, number];
};

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function normalizeHttpUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function isTwitterShortUrl(value: string): boolean {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) {
    return false;
  }

  try {
    return new URL(normalized).hostname.toLowerCase() === "t.co";
  } catch {
    return false;
  }
}

export function selectProfileWebsiteHref(
  preferredHref: string | undefined,
  fallbackUrl: string | undefined
): string | undefined {
  return asString(preferredHref) ?? asString(fallbackUrl);
}

export function formatUrlDisplayText(value: string): string {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) {
    return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, "");
    const path =
      parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    const query = parsed.search;
    const combined = `${host}${path}${query}`;
    return combined.length > 48 ? `${combined.slice(0, 45)}...` : combined;
  } catch {
    return normalized.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

export function selectTwitterDisplayText(
  displayUrl: string | undefined,
  expandedUrl: string | undefined
): string | undefined {
  const trimmedDisplayUrl = displayUrl?.trim();
  if (
    trimmedDisplayUrl &&
    trimmedDisplayUrl.length > 0 &&
    !/^t\.co(?:\/|$)/i.test(trimmedDisplayUrl) &&
    !/^https?:\/\/t\.co(?:\/|$)/i.test(trimmedDisplayUrl)
  ) {
    return trimmedDisplayUrl;
  }

  if (expandedUrl) {
    return formatUrlDisplayText(expandedUrl);
  }

  return trimmedDisplayUrl;
}

export function buildTwitterUrlEntity(args: {
  rawUrl: string;
  expandedUrl?: string;
  displayUrl?: string;
  indices: [number, number];
}): TwitterUrlEntity | null {
  const rawUrl = normalizeHttpUrl(args.rawUrl) ?? args.rawUrl.trim();
  const expandedUrl =
    (args.expandedUrl && normalizeHttpUrl(args.expandedUrl)) ??
    normalizeHttpUrl(args.rawUrl);

  if (!expandedUrl) {
    return null;
  }

  return {
    url: rawUrl,
    expanded_url: expandedUrl,
    display_url:
      selectTwitterDisplayText(args.displayUrl, expandedUrl) ??
      formatUrlDisplayText(expandedUrl),
    indices: args.indices,
  };
}

export function normalizeTwitterUrlEntity(
  value: unknown
): TwitterUrlEntity | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const rawUrl = asString(record.url);
  const expandedUrl =
    asString(record.expanded_url) ?? asString(record.expandedUrl);
  const displayUrl =
    asString(record.display_url) ?? asString(record.displayUrl);
  const indicesValue = Array.isArray(record.indices) ? record.indices : [];
  const start = asNumber(indicesValue[0]) ?? 0;
  const end = asNumber(indicesValue[1]) ?? start;

  if (!rawUrl) {
    return null;
  }

  return buildTwitterUrlEntity({
    rawUrl,
    expandedUrl,
    displayUrl,
    indices: [start, end],
  });
}

export function normalizeTwitterUrlEntities(
  value: unknown
): TwitterUrlEntity[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const entities = value
    .map(normalizeTwitterUrlEntity)
    .filter((entity): entity is TwitterUrlEntity => entity !== null);
  return entities.length > 0 ? entities : undefined;
}

function extractUrlEntities(value: unknown): TwitterUrlEntity[] {
  return normalizeTwitterUrlEntities(value) ?? [];
}

export function getTwitterProfileWebsiteEntity(
  profile: Record<string, unknown>
): TwitterUrlEntity | undefined {
  const entities = asRecord(profile.entities);
  const url = asRecord(entities?.url);
  return extractUrlEntities(url?.urls)[0];
}

export function getTwitterProfileBioUrlEntities(
  profile: Record<string, unknown>
): TwitterUrlEntity[] {
  const entities = asRecord(profile.entities);
  const description = asRecord(entities?.description);
  return extractUrlEntities(description?.urls);
}

export function extractTwitterBioUrlCandidates(
  description: string
): Array<{ url: string; indices: [number, number] }> {
  return detectUrls(description)
    .filter((candidate) => candidate.isValid)
    .map((candidate) => ({
      url: candidate.url,
      indices: [candidate.startIndex, candidate.endIndex] as [number, number],
    }));
}
