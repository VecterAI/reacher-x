"use client";

type UrlCache = Record<string, string>;

const LS_KEY = "RX_DESC_BY_URL_V1";

function readCache(): UrlCache {
  try {
    const raw = window.localStorage.getItem(LS_KEY) || "{}";
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as UrlCache;
    }
    return {} as UrlCache;
  } catch {
    return {} as UrlCache;
  }
}

function writeCache(cache: UrlCache) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota or private mode errors
  }
}

export function cacheGet(url: string): string | undefined {
  const cache = readCache();
  return cache[url];
}

export function cacheSet(url: string, text: string) {
  const cache = readCache();
  cache[url] = text;
  writeCache(cache);
}

export function cacheHas(url: string): boolean {
  const cache = readCache();
  return Object.prototype.hasOwnProperty.call(cache, url);
}

export function cacheEntries(): Array<[string, string]> {
  const cache = readCache();
  return Object.entries(cache);
}

export function cacheClear() {
  writeCache({});
}

