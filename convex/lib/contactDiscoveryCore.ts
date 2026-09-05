"use node";

import {
  formatUrlDisplayText,
  normalizeHttpUrl,
} from "../../shared/lib/twitter/profileLinks";
import {
  buildTelHref,
  extractEmailsFromText,
  extractPhoneNumbersFromText,
  normalizeEmailAddress,
  normalizePhoneNumber,
  type ProspectContactSource,
  type ProspectContactSourceType,
} from "../../shared/lib/utils/contact/contactUtils";
import { isPublicHttpUrl } from "../../shared/lib/utils/url/urlSafety";

const DEFAULT_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

const PAGE_FETCH_TIMEOUT_MS = 8_000;
const MAX_WEBSITE_SOURCE_URLS = 3;
const MAX_CONTACT_PAGES = 3;
const MIN_EMAIL_CONFIDENCE = 0.84;
const MIN_PHONE_CONFIDENCE = 0.86;
const CONTACT_PAGE_HINT_REGEX =
  /(contact|contact-us|about|about-us|get-in-touch|support|team|company)/i;
const MAILTO_HREF_REGEX = /href=["']mailto:([^"'?#]+)(?:\?[^"']*)?["']/gi;
const TEL_HREF_REGEX = /href=["']tel:([^"']+)["']/gi;
const LINK_HREF_REGEX =
  /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const TITLE_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;

type ContactKind = "email" | "phone";

type ContactCandidate = {
  kind: ContactKind;
  value: string;
  normalizedValue: string;
  source: ProspectContactSource;
};

type WebsitePage = {
  url: string;
  text: string;
  html: string;
  title?: string;
};

export interface DiscoveredContactValue {
  value: string;
  source: ProspectContactSource;
}

export interface DiscoverPublicContactInfoArgs {
  platform: "twitter" | "linkedin";
  profileUrl?: string;
  profileTextBlocks?: Array<{ label: string; text?: string | null }>;
  posts?: Array<{ url?: string; text?: string | null }>;
  websiteUrls?: Array<string | undefined>;
  structuredEmail?: string;
  structuredPhone?: string;
}

export interface DiscoverPublicContactInfoResult {
  email?: DiscoveredContactValue;
  phone?: DiscoveredContactValue;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(0.99, Number(value.toFixed(2))));
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function extractTitle(html: string): string | undefined {
  const match = TITLE_REGEX.exec(html);
  if (!match) {
    return undefined;
  }

  const title = decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim();
  return title.length > 0 ? title : undefined;
}

function stripHtmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function buildSnippet(
  text: string,
  startIndex: number,
  endIndex: number
): string {
  const snippetStart = Math.max(0, startIndex - 64);
  const snippetEnd = Math.min(text.length, endIndex + 64);
  return text.slice(snippetStart, snippetEnd).replace(/\s+/g, " ").trim();
}

function normalizeWebsiteSourceUrl(
  value: string | undefined
): string | undefined {
  const normalized = value ? normalizeHttpUrl(value) : undefined;
  return isPublicHttpUrl(normalized) ? normalized : undefined;
}

function getWebsiteSourceType(url: string): ProspectContactSourceType {
  try {
    const pathname = new URL(url).pathname;
    return CONTACT_PAGE_HINT_REGEX.test(pathname)
      ? "website_contact_page"
      : "website";
  } catch {
    return "website";
  }
}

function buildWebsiteSourceLabel(url: string): string {
  const formatted = formatUrlDisplayText(url);
  return formatted.length > 0 ? formatted : "Website";
}

async function fetchPublicPage(url: string): Promise<WebsitePage | null> {
  const normalizedUrl = normalizeWebsiteSourceUrl(url);
  if (!normalizedUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(normalizedUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: DEFAULT_FETCH_HEADERS,
    });
    if (!response.ok) {
      return null;
    }

    const finalUrl = normalizeWebsiteSourceUrl(response.url) ?? normalizedUrl;
    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      contentType.length > 0
    ) {
      return null;
    }

    const html = await response.text();
    const text = stripHtmlToText(html);
    if (!text) {
      return null;
    }

    return {
      url: finalUrl,
      html,
      text,
      title: extractTitle(html),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractSameOriginContactLinks(page: WebsitePage): string[] {
  const links = new Set<string>();

  try {
    const baseUrl = new URL(page.url);
    let match: RegExpExecArray | null;

    LINK_HREF_REGEX.lastIndex = 0;
    while ((match = LINK_HREF_REGEX.exec(page.html)) !== null) {
      const href = match[1]?.trim();
      const linkText = stripHtmlToText(match[2] ?? "");
      if (!href) {
        continue;
      }

      let resolved: URL;
      try {
        resolved = new URL(href, baseUrl);
      } catch {
        continue;
      }

      if (
        resolved.origin !== baseUrl.origin ||
        // A path-scoped profile on a shared host does not own that host's
        // support/legal/contact pages. Crawl only within its linked subtree.
        (baseUrl.pathname !== "/" &&
          resolved.pathname !== baseUrl.pathname &&
          !resolved.pathname.startsWith(
            `${baseUrl.pathname.replace(/\/$/, "")}/`
          )) ||
        !isPublicHttpUrl(resolved.toString())
      ) {
        continue;
      }

      const candidate = normalizeHttpUrl(resolved.toString());
      if (
        candidate &&
        (CONTACT_PAGE_HINT_REGEX.test(resolved.pathname) ||
          CONTACT_PAGE_HINT_REGEX.test(linkText))
      ) {
        links.add(candidate);
      }

      if (links.size >= MAX_CONTACT_PAGES) {
        break;
      }
    }
  } catch {
    return [];
  }

  return [...links];
}

function addTextCandidatesFromSource(args: {
  candidates: ContactCandidate[];
  sourceType: ProspectContactSourceType;
  sourceUrl?: string;
  sourceLabel: string;
  text: string;
  includePhone?: boolean;
  confidence: {
    email: number;
    phone: number;
  };
}) {
  for (const email of extractEmailsFromText(args.text)) {
    args.candidates.push({
      kind: "email",
      value: email.value,
      normalizedValue: email.normalizedValue,
      source: {
        sourceType: args.sourceType,
        sourceUrl: args.sourceUrl,
        sourceLabel: args.sourceLabel,
        confidence: args.confidence.email,
        sourceSnippet: buildSnippet(
          args.text,
          email.startIndex,
          email.endIndex
        ),
      },
    });
  }

  for (const phone of args.includePhone === false
    ? []
    : extractPhoneNumbersFromText(args.text)) {
    args.candidates.push({
      kind: "phone",
      value: phone.value,
      normalizedValue: phone.normalizedValue,
      source: {
        sourceType: args.sourceType,
        sourceUrl: args.sourceUrl,
        sourceLabel: args.sourceLabel,
        confidence: args.confidence.phone,
        sourceSnippet: buildSnippet(
          args.text,
          phone.startIndex,
          phone.endIndex
        ),
      },
    });
  }
}

function addHrefCandidatesFromWebsite(
  page: WebsitePage,
  candidates: ContactCandidate[]
) {
  const sourceType = getWebsiteSourceType(page.url);
  const sourceLabel = buildWebsiteSourceLabel(page.url);

  let match: RegExpExecArray | null;

  MAILTO_HREF_REGEX.lastIndex = 0;
  while ((match = MAILTO_HREF_REGEX.exec(page.html)) !== null) {
    const normalizedValue = normalizeEmailAddress(match[1]);
    if (!normalizedValue) {
      continue;
    }

    candidates.push({
      kind: "email",
      value: normalizedValue,
      normalizedValue,
      source: {
        sourceType,
        sourceUrl: page.url,
        sourceLabel,
        confidence: sourceType === "website_contact_page" ? 0.98 : 0.96,
      },
    });
  }

  TEL_HREF_REGEX.lastIndex = 0;
  while ((match = TEL_HREF_REGEX.exec(page.html)) !== null) {
    const normalizedValue = normalizePhoneNumber(match[1]);
    if (!normalizedValue) {
      continue;
    }

    candidates.push({
      kind: "phone",
      value: normalizedValue,
      normalizedValue,
      source: {
        sourceType,
        sourceUrl: page.url,
        sourceLabel,
        confidence: sourceType === "website_contact_page" ? 0.98 : 0.96,
      },
    });
  }
}

function aggregateBestCandidate(
  candidates: ContactCandidate[],
  kind: ContactKind,
  minimumConfidence: number
): DiscoveredContactValue | undefined {
  const filtered = candidates.filter((candidate) => candidate.kind === kind);
  if (filtered.length === 0) {
    return undefined;
  }

  const aggregated = new Map<
    string,
    {
      best: ContactCandidate;
      sourceKeys: Set<string>;
      sourceTypes: Set<ProspectContactSourceType>;
      maxConfidence: number;
    }
  >();

  for (const candidate of filtered) {
    const existing = aggregated.get(candidate.normalizedValue);
    const sourceKey =
      candidate.source.sourceUrl ?? candidate.source.sourceLabel;
    if (!existing) {
      aggregated.set(candidate.normalizedValue, {
        best: candidate,
        sourceKeys: new Set([sourceKey]),
        sourceTypes: new Set([candidate.source.sourceType]),
        maxConfidence: candidate.source.confidence,
      });
      continue;
    }

    existing.sourceKeys.add(sourceKey);
    existing.sourceTypes.add(candidate.source.sourceType);
    if (candidate.source.confidence > existing.maxConfidence) {
      existing.best = candidate;
      existing.maxConfidence = candidate.source.confidence;
    }
  }

  const ranked = [...aggregated.values()]
    .map((entry) => {
      const corroborationBoost = Math.min(
        0.08,
        (entry.sourceKeys.size - 1) * 0.03 + (entry.sourceTypes.size - 1) * 0.02
      );
      const confidence = clampConfidence(
        entry.maxConfidence + corroborationBoost
      );
      return {
        value: entry.best.value,
        source: {
          ...entry.best.source,
          confidence,
        },
      };
    })
    .filter((entry) => entry.source.confidence >= minimumConfidence)
    .sort((left, right) => right.source.confidence - left.source.confidence);

  return ranked[0];
}

export async function discoverPublicContactInfo(
  args: DiscoverPublicContactInfoArgs
): Promise<DiscoverPublicContactInfoResult> {
  const candidates: ContactCandidate[] = [];
  const profileUrl = normalizeWebsiteSourceUrl(args.profileUrl);

  if (args.structuredEmail) {
    const normalizedValue = normalizeEmailAddress(args.structuredEmail);
    if (normalizedValue) {
      candidates.push({
        kind: "email",
        value: normalizedValue,
        normalizedValue,
        source: {
          sourceType: "linkedin_contact_info",
          sourceUrl: profileUrl,
          sourceLabel: "LinkedIn contact info",
          confidence: 0.99,
        },
      });
    }
  }

  if (args.structuredPhone) {
    const normalizedValue = normalizePhoneNumber(args.structuredPhone);
    if (normalizedValue) {
      candidates.push({
        kind: "phone",
        value: normalizedValue,
        normalizedValue,
        source: {
          sourceType: "linkedin_contact_info",
          sourceUrl: profileUrl,
          sourceLabel: "LinkedIn contact info",
          confidence: 0.99,
        },
      });
    }
  }

  for (const block of args.profileTextBlocks ?? []) {
    const text = block.text?.trim();
    if (!text) {
      continue;
    }

    addTextCandidatesFromSource({
      candidates,
      sourceType: "profile_bio",
      sourceUrl: profileUrl,
      sourceLabel:
        args.platform === "linkedin" ? "LinkedIn profile" : "X profile bio",
      text,
      confidence: {
        email: 0.88,
        phone: 0.88,
      },
    });
  }

  for (const post of args.posts ?? []) {
    const text = post.text?.trim();
    if (!text) {
      continue;
    }

    addTextCandidatesFromSource({
      candidates,
      sourceType: "profile_post",
      sourceUrl: normalizeWebsiteSourceUrl(post.url),
      sourceLabel: "Public post",
      text,
      confidence: {
        email: 0.8,
        phone: 0.8,
      },
    });
  }

  const websiteUrls = [
    ...new Set(
      (args.websiteUrls ?? []).map(normalizeWebsiteSourceUrl).filter(Boolean)
    ),
  ].slice(0, MAX_WEBSITE_SOURCE_URLS) as string[];

  const fetchedPages: WebsitePage[] = [];
  const fetchedPageUrls = new Set<string>();

  for (const websiteUrl of websiteUrls) {
    const page = await fetchPublicPage(websiteUrl);
    if (!page || fetchedPageUrls.has(page.url)) {
      continue;
    }

    fetchedPages.push(page);
    fetchedPageUrls.add(page.url);

    for (const contactLink of extractSameOriginContactLinks(page)) {
      if (fetchedPages.length >= MAX_CONTACT_PAGES + MAX_WEBSITE_SOURCE_URLS) {
        break;
      }
      const contactPage = await fetchPublicPage(contactLink);
      if (!contactPage || fetchedPageUrls.has(contactPage.url)) {
        continue;
      }
      fetchedPages.push(contactPage);
      fetchedPageUrls.add(contactPage.url);
    }
  }

  for (const page of fetchedPages) {
    addHrefCandidatesFromWebsite(page, candidates);
    addTextCandidatesFromSource({
      candidates,
      sourceType: getWebsiteSourceType(page.url),
      sourceUrl: page.url,
      sourceLabel: buildWebsiteSourceLabel(page.url),
      text: page.text,
      // Raw website numbers may be registration IDs, prices or analytics—not
      // contact information. Only explicit tel links supply website phones.
      includePhone: false,
      confidence: {
        email:
          getWebsiteSourceType(page.url) === "website_contact_page"
            ? 0.94
            : 0.9,
        phone:
          getWebsiteSourceType(page.url) === "website_contact_page"
            ? 0.95
            : 0.9,
      },
    });
  }

  const email = aggregateBestCandidate(
    candidates,
    "email",
    MIN_EMAIL_CONFIDENCE
  );
  const phone = aggregateBestCandidate(
    candidates,
    "phone",
    MIN_PHONE_CONFIDENCE
  );

  return {
    email,
    phone: phone && buildTelHref(phone.value).length >= 7 ? phone : undefined,
  };
}
