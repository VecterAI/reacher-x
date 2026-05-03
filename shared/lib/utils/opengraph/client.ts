/**
 * Client-side Open Graph fetching utilities
 */

import type {
  OpenGraphData,
  FetchOpenGraphOptions,
  FetchOpenGraphResult,
} from "./types";

/**
 * Enhanced Open Graph fetching with retry logic, caching, and better error handling
 * Uses server-side API route to avoid CORS issues
 */
export async function fetchOpenGraph(
  url: string,
  options: FetchOpenGraphOptions = {}
): Promise<FetchOpenGraphResult> {
  const { timeout = 8000, cache = true } = options;

  // Check cache first if enabled
  if (cache) {
    const { openGraphCache } = await import("./cache");
    const cachedData = openGraphCache.get(url);
    if (cachedData !== undefined) {
      return {
        data: cachedData,
        fromCache: true,
      };
    }
  }

  // Use server-side API route to avoid CORS issues
  try {
    const apiUrl = `/api/opengraph?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(apiUrl, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${res.status}: ${res.statusText}`
      );
    }

    const result = await res.json();

    if (result.success && result.data) {
      // Cache the result if enabled
      if (cache) {
        const { openGraphCache } = await import("./cache");
        openGraphCache.set(url, result.data);
      }

      return {
        data: result.data,
        fromCache: result.fromCache || false,
      };
    } else {
      return {
        data: null,
        error: result.error || "Failed to fetch Open Graph data",
      };
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export function extractOgFromHtml(
  html: string,
  baseUrl: string
): OpenGraphData {
  // More robust regex patterns that handle various quote styles and whitespace
  const getMetaProperty = (prop: string): string | null => {
    const patterns = [
      new RegExp(
        `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+property=["']${prop}["'][^>]+content=[""]([^""]+)[""]`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=[""]([^""]+)[""][^>]+property=["']${prop}["']`,
        "i"
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return decodeHtmlEntities(match[1].trim());
      }
    }
    return null;
  };

  const getMetaName = (name: string): string | null => {
    const patterns = [
      new RegExp(
        `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+name=["']${name}["'][^>]+content=[""]([^""]+)[""]`,
        "i"
      ),
      new RegExp(
        `<meta[^>]+content=[""]([^""]+)[""][^>]+name=["']${name}["']`,
        "i"
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return decodeHtmlEntities(match[1].trim());
      }
    }
    return null;
  };

  // Extract title from <title> tag as fallback
  const getTitleTag = (): string | null => {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1].trim()) : null;
  };

  // Extract favicon
  const getFavicon = (): string | null => {
    const faviconPatterns = [
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
    ];

    for (const pattern of faviconPatterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const href = match[1].trim();
        return href.startsWith("http")
          ? href
          : new URL(href, baseUrl).toString();
      }
    }
    return null;
  };

  // Extract Open Graph data with fallbacks
  const ogImage = getMetaProperty("og:image") || getMetaName("twitter:image");
  const title =
    getMetaProperty("og:title") ||
    getMetaName("twitter:title") ||
    getTitleTag();
  const description =
    getMetaProperty("og:description") || getMetaName("twitter:description");
  const siteName = getMetaProperty("og:site_name");
  const type = getMetaProperty("og:type");
  const locale = getMetaProperty("og:locale");
  const favicon = getFavicon();

  // Convert relative URLs to absolute URLs
  const makeAbsolute = (url: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  };

  return {
    url: baseUrl,
    title: title || null,
    description: description || null,
    image: makeAbsolute(ogImage),
    siteName: siteName || null,
    type: type || null,
    locale: locale || null,
    favicon: makeAbsolute(favicon),
  };
}

/**
 * Decode HTML entities in meta content
 */
function decodeHtmlEntities(str: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
  };

  return str.replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
    return entities[entity] || entity;
  });
}
