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
    return await resolveRedirectChainWithMethod(normalizedUrl, "HEAD", options);
  } catch {
    try {
      return await resolveRedirectChainWithMethod(normalizedUrl, "GET", options);
    } catch {
      return undefined;
    }
  }
}
