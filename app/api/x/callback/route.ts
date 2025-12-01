import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/shared/lib/utils/storage";
import { createOAuthClient, handleTwitterError } from "@/convex/twitterClient";
import { logger } from "@/shared/lib/logger";

// Exchange code for tokens and persist via Convex
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("x_oauth_state")?.value;
  const codeVerifier = cookieStore.get("x_code_verifier")?.value;
  const returnTo = cookieStore.get("x_return_to")?.value;

  // Clear cookies early
  cookieStore.delete("x_oauth_state");
  cookieStore.delete("x_code_verifier");
  cookieStore.delete("x_return_to");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=error_state`
    );
  }
  if (!codeVerifier) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=missing_verifier`
    );
  }

  const redirectUri =
    process.env.X_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/x/callback`;

  if (!redirectUri) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=server_misconfig`
    );
  }

  try {
    // Create OAuth client using twitter-api-v2
    const client = createOAuthClient();

    // Exchange code for tokens using twitter-api-v2
    const {
      client: loggedClient,
      accessToken,
      refreshToken,
      expiresIn,
    } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri,
    });

    // Fetch user identity using twitter-api-v2
    const userData = await loggedClient.v2.me({
      "user.fields": ["profile_image_url", "name", "username"],
    });

    const xUserId: string = userData.data.id;
    const screenName: string | undefined = userData.data.username;

    if (!xUserId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=invalid_user`
      );
    }

    // Store tokens in secure session instead of URL
    const tokenData = {
      accessToken,
      refreshToken,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
      tokenType: "Bearer",
      scope: "tweet.read tweet.write users.read offline.access media.write",
      xUserId,
      screenName,
    };

    // Create secure session with token data
    const sessionId = await createSession(tokenData);
    const base = process.env.NEXT_PUBLIC_SITE_URL;
    const nextUrl = returnTo
      ? `${base}${returnTo.startsWith("/") ? returnTo : `/${returnTo}`}`
      : `${base}/settings/linked-accounts`;
    const sep = nextUrl.includes("?") ? "&" : "?";
    return NextResponse.redirect(
      `${nextUrl}${sep}x_status=success&session=${sessionId}`
    );
  } catch (err) {
    logger.error("X OAuth callback error:", err);

    // Use enhanced error handling
    try {
      handleTwitterError(err);
    } catch (error) {
      logger.error("Twitter API error:", error);
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=exception`
    );
  }
}
