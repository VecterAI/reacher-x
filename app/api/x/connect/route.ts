import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createOAuthClient } from "../../../../convex/twitterClient";

// Best practices (@Web Next.js + Convex):
// - Keep OAuth secrets server-side only.
// - Use httpOnly, Secure cookies for short-lived PKCE data.
// - Do not expose tokens to the client; complete exchange server-side.

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const { searchParams } = new URL(request.url);
    const returnTo = searchParams.get("returnTo");

    const redirectUri =
      process.env.X_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/x/callback`;

    if (!redirectUri) {
      return NextResponse.json(
        { error: "Server is not configured for X OAuth" },
        { status: 500 }
      );
    }

    // Create OAuth client using twitter-api-v2
    const client = createOAuthClient();

    // Scopes required for reply with media (subject to app access level)
    const scopes = [
      "tweet.read",
      "tweet.write",
      "users.read",
      "offline.access",
      "media.write",
    ];

    // Generate OAuth2 auth link using twitter-api-v2
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
      redirectUri,
      {
        scope: scopes,
      }
    );

    // Persist short-lived, httpOnly cookies
    const maxAge = 10 * 60; // 10 minutes
    const isDevelopment = process.env.NODE_ENV === "development";

    cookieStore.set("x_oauth_state", state, {
      httpOnly: true,
      secure: !isDevelopment, // Only secure in production
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    cookieStore.set("x_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: !isDevelopment, // Only secure in production
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    // Optionally remember return destination
    if (returnTo) {
      cookieStore.set("x_return_to", returnTo, {
        httpOnly: true,
        secure: !isDevelopment,
        sameSite: "lax",
        path: "/",
        maxAge,
      });
    }

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("OAuth connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
