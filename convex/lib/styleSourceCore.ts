import type { Doc } from "../_generated/dataModel";
import type { WorkspaceMemoryCategory } from "./agentMemoryCore";

export type StyleSourcePlatform = "twitter" | "linkedin";

export function getStyleMemoryCategory(
  platform: StyleSourcePlatform
): WorkspaceMemoryCategory {
  return platform === "linkedin"
    ? "writing_style_profile_linkedin"
    : "writing_style_profile_twitter";
}

export function getStyleDisplayLabel(platform: StyleSourcePlatform): string {
  return platform === "linkedin" ? "LinkedIn" : "X";
}

export function isStyleMemoryCategory(
  category: string
): category is
  | "writing_style_profile_twitter"
  | "writing_style_profile_linkedin" {
  return (
    category === "writing_style_profile_twitter" ||
    category === "writing_style_profile_linkedin"
  );
}

export function buildStyleSourceKey(
  platform: StyleSourcePlatform,
  externalUserId: string
): string {
  return `${platform}:${externalUserId}`;
}

export function getNextStyleSourceVersion(args: {
  previousAccount?: {
    styleSourceKey?: string;
    styleSourceVersion?: number;
  } | null;
  nextSourceKey: string;
  now: number;
}): number {
  if (
    args.previousAccount?.styleSourceKey === args.nextSourceKey &&
    typeof args.previousAccount.styleSourceVersion === "number"
  ) {
    return args.previousAccount.styleSourceVersion;
  }

  return args.now;
}

export function isActiveStyleSource(
  account:
    | Pick<
        Doc<"xAccounts">,
        "styleSourceKey" | "styleSourceVersion" | "xUserId"
      >
    | Pick<
        Doc<"linkedinAccounts">,
        "styleSourceKey" | "styleSourceVersion" | "providerId"
      >
    | null
    | undefined,
  args: {
    platform: StyleSourcePlatform;
    sourceVersion?: number | null;
    sourceExternalUserId?: string | null;
  }
): boolean {
  if (!account) {
    return false;
  }

  if (typeof args.sourceVersion !== "number") {
    return false;
  }

  if (account.styleSourceVersion !== args.sourceVersion) {
    return false;
  }

  if (
    typeof args.sourceExternalUserId === "string" &&
    args.sourceExternalUserId.length > 0
  ) {
    return (
      account.styleSourceKey ===
      buildStyleSourceKey(args.platform, args.sourceExternalUserId)
    );
  }

  return true;
}
