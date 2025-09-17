import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Best practices (@Web Next.js + Convex):
// - Keep OAuth secrets server-side only.
// - Use httpOnly, Secure cookies for short-lived PKCE data.
// - Do not expose tokens to the client; complete exchange server-side.

function base64UrlEncode(buffer: ArrayBuffer): string {
  return Buffer.from(new Uint8Array(buffer))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

function randomString(length = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

export async function GET() {
  const cookieStore = await cookies();

  const clientId = process.env.X_CLIENT_ID;
  const authorizeUrl =
    process.env.X_OAUTH_AUTHORIZE_URL ||
    "https://twitter.com/i/oauth2/authorize";
  const redirectUri =
    process.env.X_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/x/callback`;

  console.log("OAuth Configuration:", {
    clientId: clientId ? "present" : "missing",
    redirectUri,
    authorizeUrl,
  });

  if (!clientId || !redirectUri) {
    console.log("Missing required OAuth configuration");
    return NextResponse.json(
      { error: "Server is not configured for X OAuth" },
      { status: 500 }
    );
  }

  // Generate PKCE values
  const codeVerifier = randomString(96);
  const codeChallenge = await sha256(codeVerifier);
  const state = randomString(32);

  // Persist short-lived, httpOnly cookies
  const maxAge = 10 * 60; // 10 minutes
  const isDevelopment = process.env.NODE_ENV === "development";

  console.log("=== X OAuth Connect Route ===");
  console.log("Generated state:", state);
  console.log("Generated codeVerifier:", codeVerifier ? "present" : "missing");
  console.log("Is development:", isDevelopment);
  console.log("Cookie secure setting:", !isDevelopment);

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

  console.log("Cookies set successfully");

  // Scopes required for reply with media (subject to app access level)
  const scopes = [
    "tweet.read",
    "tweet.write",
    "users.read",
    "offline.access",
    // media.write is required for v2 media endpoints when available
    // Note: media upload often uses v1.1 endpoints authorized by the same token
    "media.write",
  ];

  const url = new URL(authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  console.log("Redirecting to X OAuth URL:", url.toString());
  return NextResponse.redirect(url.toString());
}
