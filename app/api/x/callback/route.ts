import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/shared/lib/utils/storage";
import { TwitterApi } from "twitter-api-v2";
import { logger } from "@/shared/lib/logger";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";

/**
 * Twitter OAuth 2.0 token response shape.
 * Per RFC 6749 and X API docs, this includes the actual granted scope.
 */
interface TwitterTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope: string; // Actual granted scopes (may differ from requested)
}

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
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/connected-accounts?x_status=error_state`
    );
  }
  if (!codeVerifier) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/connected-accounts?x_status=missing_verifier`
    );
  }

  const redirectUri =
    process.env.X_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/x/callback`;
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  if (!redirectUri || !clientId || !clientSecret) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/connected-accounts?x_status=server_misconfig`
    );
  }

  try {
    // =========================================================================
    // Manual token exchange to capture actual granted scope from Twitter
    // twitter-api-v2's loginWithOAuth2 doesn't expose the scope field
    // =========================================================================
    const tokenResponse = await fetch(
      "https://api.twitter.com/2/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error("Token exchange failed:", tokenResponse.status, errorText);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/settings/connected-accounts?x_status=token_error`
      );
    }

    const tokenData: TwitterTokenResponse = await tokenResponse.json();

    // Log actual granted scopes for debugging
    logger.info("[OAuth] Granted scopes:", tokenData.scope);

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;
    const actualScope = tokenData.scope; // Real scopes from Twitter!

    // Create Twitter client with the access token to fetch user identity
    const loggedClient = new TwitterApi(accessToken);

    // Fetch user identity using twitter-api-v2
    const userData = await loggedClient.v2.me({
      "user.fields": ["profile_image_url", "name", "username"],
    });

    const xUserId: string = userData.data.id;
    const screenName: string | undefined = userData.data.username;

    if (!xUserId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/settings/connected-accounts?x_status=invalid_user`
      );
    }

    // Store tokens in secure session - using ACTUAL granted scope
    const sessionData = {
      accessToken,
      refreshToken,
      expiresAt: expiresIn
        ? getCurrentUTCTimestamp() + expiresIn * 1000
        : undefined,
      tokenType: tokenData.token_type,
      scope: actualScope, // Use actual scope from Twitter, not hardcoded!
      xUserId,
      screenName,
    };

    // Create secure session with token data
    const sessionId = await createSession(sessionData);
    const base = process.env.NEXT_PUBLIC_SITE_URL;
    const nextUrl = returnTo
      ? `${base}${returnTo.startsWith("/") ? returnTo : `/${returnTo}`}`
      : `${base}/settings/connected-accounts`;
    const sep = nextUrl.includes("?") ? "&" : "?";
    return NextResponse.redirect(
      `${nextUrl}${sep}x_status=success&session=${sessionId}`
    );
  } catch (err) {
    logger.error("X OAuth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/connected-accounts?x_status=exception`
    );
  }
}
