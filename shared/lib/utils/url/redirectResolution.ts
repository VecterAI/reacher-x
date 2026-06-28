import { normalizeHttpUrl } from "../../twitter/profileLinks";
import { isPublicHttpUrl } from "./urlSafety";

export type RedirectResolverOptions = {
  fetchInit?: RequestInit;
  maxRedirects?: number;
  timeoutMs?: number;
};

const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 8000;

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function resolveLocationUrl(
  location: string | null,
  currentUrl: string
): string | undefined {
  if (!location) {
    return undefined;
  }

  try {
    const nextUrl = new URL(location, currentUrl).toString();
    return normalizeHttpUrl(nextUrl);
  } catch {
    return undefined;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeHtmlRedirectTarget(
  value: string,
  currentUrl: string
): string | undefined {
  const unescaped = value
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .trim();

  try {
    const nextUrl = new URL(unescaped, currentUrl).toString();
    return normalizeHttpUrl(nextUrl);
  } catch {
    return undefined;
  }
}

async function extractHtmlRedirectUrl(
  response: Response,
  currentUrl: string
): Promise<string | undefined> {
  const html = await response.text();
  if (!html) {
    return undefined;
  }

  const patterns = [
    /location\.replace\(["']([^"']+)["']\)/i,
    /http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>]+)/i,
    /<title>\s*(https?:\/\/[^<\s]+)\s*<\/title>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const candidate = match?.[1];
    const normalized = candidate
      ? normalizeHtmlRedirectTarget(candidate, currentUrl)
      : undefined;
    if (normalized && isPublicHttpUrl(normalized)) {
      return normalized;
    }
  }

  return undefined;
}

async function resolveRedirectChainWithMethod(
  url: string,
  method: "HEAD" | "GET",
  options: RedirectResolverOptions
): Promise<string | undefined> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let currentUrl = url;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const response = await fetchWithTimeout(
      currentUrl,
      {
        ...options.fetchInit,
        method,
        redirect: "manual",
        cache: "no-store",
      },
      timeoutMs
    );

    const responseUrl = normalizeHttpUrl(response.url);
    if (
      responseUrl &&
      responseUrl !== currentUrl &&
      isPublicHttpUrl(responseUrl)
    ) {
      currentUrl = responseUrl;
    }

    if (!isRedirectStatus(response.status)) {
      if (method === "GET") {
        const htmlRedirectUrl = await extractHtmlRedirectUrl(
          response,
          currentUrl
        );
        if (htmlRedirectUrl && htmlRedirectUrl !== currentUrl) {
          currentUrl = htmlRedirectUrl;
          continue;
        }
      }

      return currentUrl;
    }

    const nextUrl = resolveLocationUrl(
      response.headers.get("location"),
      currentUrl
    );
    if (!nextUrl || !isPublicHttpUrl(nextUrl)) {
      return currentUrl;
    }

    currentUrl = nextUrl;
  }

  return currentUrl;
}

export async function resolveRedirectChain(
  url: string,
  options: RedirectResolverOptions = {}
): Promise<string | undefined> {
  const normalizedUrl = normalizeHttpUrl(url);
  if (!isPublicHttpUrl(normalizedUrl)) {
    return undefined;
  }

  try {
    const headResolvedUrl = await resolveRedirectChainWithMethod(
      normalizedUrl,
      "HEAD",
      options
    );
    if (headResolvedUrl && headResolvedUrl !== normalizedUrl) {
      return headResolvedUrl;
    }
  } catch {
    // Ignore HEAD failures and fall back to a GET request.
  }

  try {
    return await resolveRedirectChainWithMethod(normalizedUrl, "GET", options);
  } catch {
    return undefined;
  }
}
