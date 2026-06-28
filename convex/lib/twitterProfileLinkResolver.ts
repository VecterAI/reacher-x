"use node";

import {
  buildTwitterUrlEntity,
  extractTwitterBioUrlCandidates,
  formatUrlDisplayText,
  getTwitterProfileBioUrlEntities,
  getTwitterProfileWebsiteEntity,
  isTwitterShortUrl,
  normalizeHttpUrl,
  selectTwitterDisplayText,
  type TwitterUrlEntity,
} from "../../shared/lib/twitter/profileLinks";
import { resolveRedirectChain } from "../../shared/lib/utils/url/redirectResolution";
import { isPublicHttpUrl } from "../../shared/lib/utils/url/urlSafety";

const URL_RESOLUTION_TIMEOUT_MS = 6000;
const SITE_RESOLUTION_TIMEOUT_MS = 8000;
const MAX_BIO_URL_ENTITIES = 5;
const DEFAULT_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getEnvValue(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function getPublicSiteUrl(): string | undefined {
  const siteUrl = getEnvValue(
    "TWITTER_LINK_RESOLVER_BASE_URL",
    "NEXT_PUBLIC_SITE_URL"
  )?.replace(/\/$/, "");
  return siteUrl && isPublicHttpUrl(siteUrl) ? siteUrl : undefined;
}

async function fetchResolvedUrl(
  url: string
): Promise<string | undefined> {
  try {
    const resolvedUrl = await resolveRedirectChain(url, {
      timeoutMs: URL_RESOLUTION_TIMEOUT_MS,
      fetchInit: {
        headers: DEFAULT_FETCH_HEADERS,
      },
    });
    return isPublicHttpUrl(resolvedUrl) ? resolvedUrl : undefined;
  } catch {
    return undefined;
  }
}

async function resolveExternalUrlViaPublicSite(
  url: string
): Promise<string | undefined> {
  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) {
    return undefined;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SITE_RESOLUTION_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${siteUrl}/api/resolve-twitter-url?url=${encodeURIComponent(url)}`,
      {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return undefined;
    }

    const payload = asRecord(await response.json());
    if (!payload || payload.success !== true) {
      return undefined;
    }

    const resolvedUrl = asString(payload.resolvedUrl);
    return isPublicHttpUrl(resolvedUrl) ? resolvedUrl : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveExternalUrl(
  url: string
): Promise<string | undefined> {
  const normalized = normalizeHttpUrl(url);
  if (!isPublicHttpUrl(normalized)) {
    return undefined;
  }

  if (!isTwitterShortUrl(normalized)) {
    return normalized;
  }

  const directlyResolvedUrl = await fetchResolvedUrl(normalized);
  if (directlyResolvedUrl && !isTwitterShortUrl(directlyResolvedUrl)) {
    return directlyResolvedUrl;
  }

  const siteResolvedUrl = await resolveExternalUrlViaPublicSite(normalized);
  if (siteResolvedUrl && !isTwitterShortUrl(siteResolvedUrl)) {
    return siteResolvedUrl;
  }

  return normalized;
}

async function resolveTwitterUrlEntity(
  entity: TwitterUrlEntity
): Promise<TwitterUrlEntity> {
  const expandedUrl =
    (await resolveExternalUrl(entity.expanded_url)) ??
    (await resolveExternalUrl(entity.url)) ??
    normalizeHttpUrl(entity.expanded_url) ??
    normalizeHttpUrl(entity.url) ??
    entity.expanded_url;

  return {
    url: normalizeHttpUrl(entity.url) ?? entity.url,
    expanded_url: expandedUrl,
    display_url:
      selectTwitterDisplayText(entity.display_url, expandedUrl) ??
      formatUrlDisplayText(expandedUrl),
    indices: entity.indices,
  };
}

async function resolveProfileWebsiteEntity(
  profile: Record<string, unknown>
): Promise<TwitterUrlEntity | undefined> {
  const entity = getTwitterProfileWebsiteEntity(profile);
  if (entity) {
    return await resolveTwitterUrlEntity(entity);
  }

  const rawUrl = asString(profile.url);
  if (!rawUrl) {
    return undefined;
  }

  const expandedUrl = await resolveExternalUrl(rawUrl);
  const normalizedExpandedUrl =
    expandedUrl ?? normalizeHttpUrl(rawUrl) ?? undefined;
  if (!normalizedExpandedUrl) {
    return undefined;
  }

  return (
    buildTwitterUrlEntity({
      rawUrl,
      expandedUrl: normalizedExpandedUrl,
      displayUrl: selectTwitterDisplayText(undefined, normalizedExpandedUrl),
      indices: [0, rawUrl.length],
    }) ?? undefined
  );
}

async function resolveProfileBioUrlEntities(
  profile: Record<string, unknown>
): Promise<TwitterUrlEntity[] | undefined> {
  const existingEntities = getTwitterProfileBioUrlEntities(profile).slice(
    0,
    MAX_BIO_URL_ENTITIES
  );
  const description =
    asString(profile.description) ?? asString(profile.bio) ?? "";

  const candidates =
    existingEntities.length > 0
      ? existingEntities
      : extractTwitterBioUrlCandidates(description)
          .slice(0, MAX_BIO_URL_ENTITIES)
          .map((candidate) =>
            buildTwitterUrlEntity({
              rawUrl: candidate.url,
              expandedUrl: candidate.url,
              indices: candidate.indices,
            })
          )
          .filter((entity): entity is TwitterUrlEntity => entity !== null);

  if (candidates.length === 0) {
    return undefined;
  }

  const resolved = await Promise.all(
    candidates.map((candidate) => resolveTwitterUrlEntity(candidate))
  );

  return resolved.length > 0 ? resolved : undefined;
}

export async function hydrateTwitterProfileLinkMetadata<T extends object>(
  profile: T
): Promise<{
  profile: T;
  websiteHref?: string;
  websiteDisplayText?: string;
  bioUrlEntities?: TwitterUrlEntity[];
}> {
  const profileRecord = profile as Record<string, unknown>;
  const [websiteEntity, bioUrlEntities] = await Promise.all([
    resolveProfileWebsiteEntity(profileRecord),
    resolveProfileBioUrlEntities(profileRecord),
  ]);

  const websiteHref =
    websiteEntity && !isTwitterShortUrl(websiteEntity.expanded_url)
      ? websiteEntity.expanded_url
      : undefined;
  const websiteDisplayText =
    websiteHref && websiteEntity
      ? selectTwitterDisplayText(websiteEntity.display_url, websiteHref)
      : undefined;

  const existingEntities = asRecord(profileRecord.entities);
  const nextEntities: Record<string, unknown> = { ...existingEntities };

  if (bioUrlEntities && bioUrlEntities.length > 0) {
    nextEntities.description = { urls: bioUrlEntities };
  }

  if (websiteEntity) {
    nextEntities.url = { urls: [websiteEntity] };
  }

  return {
    profile: {
      ...profileRecord,
      url: websiteHref ?? asString(profileRecord.url),
      entities:
        Object.keys(nextEntities).length > 0
          ? nextEntities
          : profileRecord.entities,
    } as T,
    websiteHref,
    websiteDisplayText,
    bioUrlEntities,
  };
}
