import { NextResponse } from "next/server";
import { getSession, deleteSession } from "@/shared/lib/utils/storage";
import { logger } from "@/shared/lib/logger";

/**
 * Secure session retrieval endpoint
 *
 * This endpoint allows the client to retrieve OAuth token data from a secure session
 * without exposing sensitive data in URLs or client-side storage.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Session ID is required" },
      { status: 400 }
    );
  }

  try {
    // Retrieve session data - sessionId is validated against stored value
    const tokenData = await getSession(sessionId);

    if (!tokenData) {
      return NextResponse.json(
        { error: "Session not found, expired, or invalid" },
        { status: 404 }
      );
    }

    // Delete the session after retrieval (one-time use)
    await deleteSession();

    return NextResponse.json({ success: true, data: tokenData });
  } catch (error) {
    logger.error("Session retrieval error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve session data" },
      { status: 500 }
    );
  }
}
