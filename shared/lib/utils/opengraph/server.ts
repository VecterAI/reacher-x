/**
 * Server-side Open Graph fetching utilities
 *
 * This module provides server-side Open Graph data extraction
 * to avoid CORS issues when fetching from client-side code.
 */

import type { OpenGraphData, FetchOpenGraphOptions, FetchOpenGraphResult } from "./types";

/**
 * Server-side Open Graph fetching with retry logic and better error handling
 */
export async function fetchOpenGraphServer(
  url: string,
  options: FetchOpenGraphOptions = {}
): Promise<FetchOpenGraphResult> {
  const {
    timeout = 10000,
    retries = 3,
    retryDelay = 1000,
    userAgent = "ReacherXBot/1.0 (+https://reacherx.com)",
    cache = true,
  } = options;

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

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": userAgent,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const html = await res.text();
      const og = extractOgFromHtml(html, url);

      // Cache the result if enabled
      if (cache && og) {
        const { openGraphCache } = await import("./cache");
        openGraphCache.set(url, og);
      }

      return { data: og };
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain errors
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            data: null,
            error: `Request timeout after ${timeout}ms`,
          };
        }

        if (error.message.includes("HTTP 4")) {
          return {
            data: null,
            error: `Client error: ${error.message}`,
          };
        }
      }

      // Wait before retry (except on last attempt)
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * (attempt + 1))
        );
      }
    }
  }

  return {
    data: null,
    error: lastError?.message || "Unknown error occurred",
  };
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

