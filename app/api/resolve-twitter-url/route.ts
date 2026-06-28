import { NextRequest, NextResponse } from "next/server";
import {
  formatUrlDisplayText,
  isTwitterShortUrl,
  normalizeHttpUrl,
} from "@/shared/lib/twitter/profileLinks";
import { resolveRedirectChain } from "@/shared/lib/utils/url/redirectResolution";
import { useLogger, withEvlog } from "@/shared/lib/logging/next";

const URL_RESOLUTION_TIMEOUT_MS = 8000;
const DEFAULT_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

export const GET = withEvlog(async (request: NextRequest) => {
  const log = useLogger();
  const rawUrl = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  const normalizedUrl = normalizeHttpUrl(rawUrl);

  if (!normalizedUrl) {
    return NextResponse.json(
      {
        success: false,
        error: "A valid URL is required.",
      },
      { status: 400 }
    );
  }

  if (!isTwitterShortUrl(normalizedUrl)) {
    return NextResponse.json(
      {
        success: false,
        error: "Only t.co URLs are supported.",
      },
      { status: 400 }
    );
  }

  log.set({
    operation: "resolve_twitter_short_url",
    twitter_short_url: {
      input_url: normalizedUrl,
    },
  });

  const resolvedCandidate = await resolveRedirectChain(normalizedUrl, {
    timeoutMs: URL_RESOLUTION_TIMEOUT_MS,
    fetchInit: {
      headers: DEFAULT_FETCH_HEADERS,
    },
  });
  const resolvedUrl =
    resolvedCandidate && !isTwitterShortUrl(resolvedCandidate)
      ? resolvedCandidate
      : normalizedUrl;
  const wasResolved = !isTwitterShortUrl(resolvedUrl);

  log.set({
    twitter_short_url: {
      input_url: normalizedUrl,
      resolved_url: resolvedUrl,
      was_resolved: wasResolved,
    },
  });

  return NextResponse.json(
    {
      success: true,
      inputUrl: normalizedUrl,
      resolvedUrl,
      displayText: formatUrlDisplayText(resolvedUrl),
      wasResolved,
    },
    {
      headers: {
        "Cache-Control": wasResolved
          ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
          : "public, max-age=300, s-maxage=300, stale-while-revalidate=300",
      },
    }
  );
});
