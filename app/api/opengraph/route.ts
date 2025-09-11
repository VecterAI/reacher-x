import { NextRequest, NextResponse } from "next/server";
import { fetchOpenGraphServer } from "@/shared/lib/utils/opengraph-server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: "URL parameter is required",
        },
        { status: 400 }
      );
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
      userAgent: "ReacherXBot/1.0 (+https://reacherx.app)",
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
    console.error("Open Graph API error:", error);

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
