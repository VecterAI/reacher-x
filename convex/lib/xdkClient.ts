"use node";

import {
  Client,
  OAuth2,
  type OAuth2Config,
  type OAuth2Token,
} from "@xdevplatform/xdk";

export const XDK_PACKAGE_VERSION = "0.5.0";

export const X_CORE_SCOPES = [
  "tweet.read",
  "users.read",
  "tweet.write",
  "like.read",
  "like.write",
  "bookmark.read",
  "bookmark.write",
  "follows.read",
  "follows.write",
  "dm.read",
  "dm.write",
  "offline.access",
] as const;

export type XScope = (typeof X_CORE_SCOPES)[number];

function getRequiredEnv(
  name: "X_API_CLIENT_ID" | "X_API_CLIENT_SECRET" | "X_API_BEARER_TOKEN"
): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set in the Convex environment.`);
  }
  return value;
}

export function getXApiClientSecret(): string {
  return getRequiredEnv("X_API_CLIENT_SECRET");
}

export function getXAppBearerToken(): string {
  return getRequiredEnv("X_API_BEARER_TOKEN");
}

export function getDefaultXRedirectUri(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!siteUrl) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is not set. It is required to build the X OAuth redirect URI."
    );
  }

  return `${siteUrl}/settings/connected-accounts`;
}

export function buildXOAuth2Config(options?: {
  redirectUri?: string;
  scope?: readonly string[];
}): OAuth2Config {
  return {
    clientId: getRequiredEnv("X_API_CLIENT_ID"),
    clientSecret: getRequiredEnv("X_API_CLIENT_SECRET"),
    redirectUri: options?.redirectUri ?? getDefaultXRedirectUri(),
    scope: [...(options?.scope ?? X_CORE_SCOPES)],
  };
}

export function createXOAuth2(options?: {
  redirectUri?: string;
  scope?: readonly string[];
}): OAuth2 {
  return new OAuth2(buildXOAuth2Config(options));
}

export function buildXClient(accessToken: string): Client {
  return new Client({
    accessToken,
  });
}

export function computeXTokenExpiry(expiresInSeconds: number): number {
  return Date.now() + expiresInSeconds * 1000;
}

export function parseGrantedScopes(token: OAuth2Token): string[] {
  return (token.scope ?? "")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}
