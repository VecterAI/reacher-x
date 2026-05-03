import { NextRequest } from "next/server";
import {
  isTwitterMediaProxyable,
  toTwitterMediaProxyUrl,
} from "@/shared/lib/twitter/mediaProxy";

function rewritePlaylistBody(body: string, sourceUrl: string): string {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return line;
      }

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          try {
            const resolved = new URL(uri, sourceUrl).toString();
            return `URI="${toTwitterMediaProxyUrl(resolved) ?? resolved}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }

      try {
        const resolved = new URL(trimmed, sourceUrl).toString();
        return toTwitterMediaProxyUrl(resolved) ?? resolved;
      } catch {
        return line;
      }
    })
    .join("\n");
}

function copyHeaderIfPresent(source: Headers, target: Headers, name: string) {
  const value = source.get(name);
  if (value) {
    target.set(name, value);
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !isTwitterMediaProxyable(url)) {
    return new Response("Invalid twitter media url", { status: 400 });
  }

  const upstreamHeaders = new Headers({
    Accept: request.headers.get("accept") ?? "*/*",
    "Accept-Encoding": "identity",
    "User-Agent":
      request.headers.get("user-agent") ??
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  });

  const range = request.headers.get("range");
  if (range) {
    upstreamHeaders.set("Range", range);
  }

  const upstream = await fetch(url, {
    method: "GET",
    headers: upstreamHeaders,
    redirect: "follow",
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new Response(null, { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const responseHeaders = new Headers();
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set(
    "Cache-Control",
    upstream.headers.get("cache-control") ??
      "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
  );

  copyHeaderIfPresent(upstream.headers, responseHeaders, "accept-ranges");
  copyHeaderIfPresent(upstream.headers, responseHeaders, "content-range");
  copyHeaderIfPresent(upstream.headers, responseHeaders, "content-length");
  copyHeaderIfPresent(upstream.headers, responseHeaders, "content-type");

  if (
    contentType.includes("application/x-mpegurl") ||
    contentType.includes("application/vnd.apple.mpegurl")
  ) {
    const playlist = await upstream.text();
    const rewritten = rewritePlaylistBody(playlist, url);
    responseHeaders.set("Content-Type", contentType || "application/x-mpegURL");
    responseHeaders.delete("content-length");
    return new Response(rewritten, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
