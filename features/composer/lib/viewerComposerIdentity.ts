import type { ComposerIdentityUser } from "../types";

/** Minimal fields from `getTwitterConnectionStatus` used for composer header + limits. */
export type XConnectionIdentitySnapshot = {
  isConnected: boolean;
  screenName?: string;
  name?: string;
  profileImageUrl?: string;
  verified?: boolean;
  postComposerMaxLength?: number;
  postComposerCountMode?: "raw" | "x_post";
};

export function parseXConnectionIdentitySnapshot(
  value: unknown
): XConnectionIdentitySnapshot | null {
  if (value === null || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.isConnected !== "boolean") return null;

  const out: XConnectionIdentitySnapshot = { isConnected: v.isConnected };
  if (typeof v.screenName === "string") out.screenName = v.screenName;
  if (typeof v.name === "string") out.name = v.name;
  if (typeof v.profileImageUrl === "string") {
    out.profileImageUrl = v.profileImageUrl;
  }
  if (typeof v.verified === "boolean") out.verified = v.verified;
  if (
    typeof v.postComposerMaxLength === "number" &&
    Number.isFinite(v.postComposerMaxLength)
  ) {
    out.postComposerMaxLength = v.postComposerMaxLength;
  }
  const mode = v.postComposerCountMode;
  if (mode === "raw" || mode === "x_post") {
    out.postComposerCountMode = mode;
  }
  return out;
}

export function buildComposerIdentityUser(
  status: XConnectionIdentitySnapshot | null | undefined,
  workosUser:
    | {
        firstName?: string | null;
        email?: string | null;
        profilePictureUrl?: string | null;
      }
    | null
    | undefined
): ComposerIdentityUser {
  return {
    name: status?.name || workosUser?.firstName || workosUser?.email || "User",
    screenName: status?.screenName ?? "",
    profileImageUrl:
      status?.profileImageUrl || workosUser?.profilePictureUrl || undefined,
    verified: status?.verified === true ? true : undefined,
  };
}
