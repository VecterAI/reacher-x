import { NextRequest, NextResponse } from "next/server";
import { fetchOpenGraphServer } from "@/shared/lib/utils/opengraph";
import { logger } from "@/shared/lib/logger";

function isHttpUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const asset = searchParams.get("asset");
    const ref = searchParams.get("ref") || undefined;

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: "URL parameter is required",
        },
        { status: 400 }
      );
    }

    // Unified image proxy branch
    if (asset === "image") {
      if (!isHttpUrl(url)) {
        return new Response("Invalid url", { status: 400 });
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return new Response("Invalid url", { status: 400 });
      }

      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".localhost") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("192.168.")
      ) {
        return new Response("Forbidden", { status: 403 });
      }

      // Helper to follow manual redirects if any CDN returns 3xx with Location
      const followRedirectIfNeeded = async (
        res: Response
      ): Promise<Response> => {
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          if (loc) {
            try {
              const absolute = new URL(loc, url).toString();
              return await fetch(absolute, {
                method: "GET",
                credentials: "omit",
                cache: "no-store",
                redirect: "follow",
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36",
                  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                  ...(ref && isHttpUrl(ref) ? { Referer: ref } : {}),
                },
              });
            } catch {
              return res;
            }
          }
        }
        return res;
      };

      let upstream: Response;
      try {
        upstream = await fetch(url, {
          method: "GET",
          credentials: "omit",
          cache: "no-store",
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            ...(ref && isHttpUrl(ref) ? { Referer: ref } : {}),
          },
        });
      } catch {
        return new Response("Upstream fetch failed", { status: 502 });
      }

      // Handle potential manual redirects
      if (upstream.status >= 300 && upstream.status < 400) {
        upstream = await followRedirectIfNeeded(upstream);
      }

      if (!upstream.ok) {
        return new Response("Upstream error", { status: upstream.status });
      }

      const contentType =
        upstream.headers.get("content-type") || "application/octet-stream";
      if (
        !contentType.startsWith("image/") &&
        contentType !== "application/octet-stream" &&
        contentType !== "image/svg+xml"
      ) {
        return new Response("Unsupported content type", { status: 415 });
      }

      const headers = new Headers();
      headers.set("Content-Type", contentType);
      const len = upstream.headers.get("content-length");
      if (len) headers.set("Content-Length", len);
      headers.set(
        "Cache-Control",
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
      );
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Vary", "Accept");

      return new Response(upstream.body, {
        status: 200,
        headers,
      });
    }

    // Validate URL format and protocol
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid URL format",
        },
        { status: 400 }
      );
    }

    // Only allow HTTP and HTTPS protocols
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        {
          success: false,
          error: "Only HTTP and HTTPS URLs are supported",
        },
        { status: 400 }
      );
    }

    // Basic URL validation - reject obvious non-content URLs
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Local URLs are not supported",
        },
        { status: 400 }
      );
    }

    // Fetch Open Graph data with server-side configuration
    const result = await fetchOpenGraphServer(url, {
      timeout: 10000, // 10 seconds timeout
      retries: 3,
      retryDelay: 1000,
      userAgent: "ReacherXBot/1.0 (+https://reacherx.com)",
      cache: true,
    });

    if (result.data) {
      return NextResponse.json({
        success: true,
        data: result.data,
        fromCache: result.fromCache || false,
      });
    } else {
      // Return 422 for client errors (like 404, 403) and 500 for server errors
      const isClientError = result.error?.includes("HTTP 4");
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to fetch Open Graph data",
        },
        { status: isClientError ? 422 : 500 }
      );
    }
  } catch (error) {
    logger.error("Open Graph API error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return NextResponse.json(
          {
            success: false,
            error: "Request timeout - the URL took too long to respond",
          },
          { status: 408 }
        );
      }

      if (error.message.includes("fetch failed")) {
        return NextResponse.json(
          {
            success: false,
            error: "Network error - unable to reach the URL",
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
