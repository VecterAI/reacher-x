"use client";

/**
 * Normalize a user-provided URL-like input into a canonical https/http URL.
 * - Adds https:// if missing
 * - Strips hash
 * - Returns null if invalid
 */
export function normalizeUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * If the entire string is a URL (no spaces, valid TLD), return the normalized URL.
 * Otherwise return null. This is more strict than normalizeUrl to avoid partial matches.
 */
export function getUrlFromWholeValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Reject if contains spaces (indicates multiple tokens)
  if (trimmed.includes(" ")) return null;
  // Must be either http(s) URL or a domain with a TLD
  const hasScheme = /^https?:\/\//i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  const endsWithDot = trimmed.endsWith(".");
  if (endsWithDot) return null; // incomplete domain like "acme."
  try {
    const u = new URL(candidate);
    // Require a dot in hostname to avoid single tokens like "localhost"
    if (!u.hostname.includes(".")) return null;
    // Validate TLD: only letters and at least 2 characters (avoid partial like ".i")
    const parts = u.hostname.split(".");
    const tld = parts[parts.length - 1];
    if (!/^[a-zA-Z]{2,63}$/.test(tld)) return null;
    // Disallow trailing unmatched parentheses/brackets (common when copying)
    if (/[([]$/.test(trimmed)) return null;
    return u.toString();
  } catch {
    return null;
  }
}
