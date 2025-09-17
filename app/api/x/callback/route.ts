import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Exchange code for tokens and persist via Convex
export async function GET(request: Request) {
  console.log("=== X OAuth Callback Route Hit ===");
  console.log("Request URL:", request.url);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  console.log("URL Params:", {
    code: code ? "present" : "missing",
    state: state ? "present" : "missing",
  });

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("x_oauth_state")?.value;
  const codeVerifier = cookieStore.get("x_code_verifier")?.value;

  // Debug logging
  console.log("OAuth Callback Debug:", {
    code: code ? "present" : "missing",
    state: state ? "present" : "missing",
    expectedState: expectedState ? "present" : "missing",
    codeVerifier: codeVerifier ? "present" : "missing",
    stateMatch: state === expectedState,
  });

  // Clear cookies early
  cookieStore.delete("x_oauth_state");
  cookieStore.delete("x_code_verifier");

  if (!code || !state || !expectedState || state !== expectedState) {
    console.log("State validation failed:", {
      code: !!code,
      state: !!state,
      expectedState: !!expectedState,
      stateMatch: state === expectedState,
    });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=error_state`
    );
  }
  if (!codeVerifier) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=missing_verifier`
    );
  }

  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  const tokenUrl =
    process.env.X_OAUTH_TOKEN_URL || "https://api.twitter.com/2/oauth2/token";
  const redirectUri =
    process.env.X_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/x/callback`;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=server_misconfig`
    );
  }

  try {
    // X/Twitter OAuth 2.0 requires Basic Authentication
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );
    const tokenRequestData = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    };

    console.log("Token exchange request:", {
      tokenUrl,
      clientId: clientId ? clientId.substring(0, 10) + "..." : "missing",
      clientSecret: clientSecret
        ? clientSecret.substring(0, 10) + "..."
        : "missing",
      code: code ? code.substring(0, 20) + "..." : "missing",
      redirectUri,
      codeVerifier: codeVerifier
        ? codeVerifier.substring(0, 10) + "..."
        : "missing",
      basicAuth: basicAuth.substring(0, 20) + "...",
    });

    const tokenResp = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams(tokenRequestData),
      cache: "no-store",
    });

    console.log("Token response status:", tokenResp.status);
    console.log(
      "Token response headers:",
      Object.fromEntries(tokenResp.headers.entries())
    );

    if (!tokenResp.ok) {
      const errorText = await tokenResp.text();
      console.log("Token exchange failed:", {
        status: tokenResp.status,
        statusText: tokenResp.statusText,
        errorBody: errorText,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=token_error`
      );
    }

    const tokenJson = await tokenResp.json();
    const accessToken: string = tokenJson.access_token;
    const refreshToken: string | undefined = tokenJson.refresh_token;
    const expiresIn: number | undefined = tokenJson.expires_in;
    const tokenType: string | undefined = tokenJson.token_type;
    const scope: string | undefined = tokenJson.scope;

    // Fetch user identity from X
    const meResp = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!meResp.ok) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=user_fetch_error`
      );
    }
    const meJson = await meResp.json();
    const xUserId: string = meJson?.data?.id;
    const screenName: string | undefined = meJson?.data?.username;

    if (!xUserId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=invalid_user`
      );
    }

    // Instead of linking here, redirect back to client with tokens
    // The client will handle the linking with proper authentication context
    const tokenData = {
      accessToken,
      refreshToken,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
      tokenType,
      scope,
      xUserId,
      screenName,
    };

    // Encode the token data as base64 to pass in URL
    const encodedTokens = Buffer.from(JSON.stringify(tokenData)).toString(
      "base64"
    );

    console.log("Redirecting to client with tokens for user:", xUserId);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=success&tokens=${encodedTokens}`
    );
  } catch (err) {
    console.error("X OAuth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/settings/linked-accounts?x_status=exception`
    );
  }
}
