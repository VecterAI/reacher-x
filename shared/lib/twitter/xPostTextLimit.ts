/**
 * X/Twitter post and reply text limits.
 *
 * Short posts: weighted length via `twitter-text` (URLs count as fixed width).
 * https://www.npmjs.com/package/twitter-text
 *
 * Long-form (X Premium / Basic / PremiumPlus): cap per product; confirm against
 * https://docs.x.com/x-api/posts/create-post and changelog.
 *
 * Subscription tier: GET /2/users/me `subscription_type`
 * https://docs.x.com/x-api/users/get-my-user
 *
 * Note: `twitter-text` v3 ESM exposes a default export object only.
 */
import twitterText from "twitter-text";

/** Weighted character cap for standard (non-long-form) posts. */
export const X_POST_WEIGHTED_MAX = 280;

/**
 * Long-form post body cap for paid X tiers (Premium product). Adjust if X docs change.
 * See https://docs.x.com/x-api/posts/create-post (TweetText / long-form behavior).
 */
export const X_LONG_FORM_POST_MAX_CHARS = 25_000;

/**
 * DM body text cap. Legacy REST docs ~10k; confirm
 * https://developer.x.com/ Direct Messages.
 */
export const X_DM_TEXT_MAX = 10_000;

export type EffectivePostTextLimit =
  | { mode: "short"; maxWeighted: number }
  | { mode: "long"; maxChars: number };

/** Maps effective limit to composer props (`ComposerCharacterCountMode` in features/composer). */
export function getComposerLimitFromEffectiveLimit(
  limit: EffectivePostTextLimit
): { maxLength: number; characterCountMode: "raw" | "x_post" } {
  if (limit.mode === "short") {
    return { maxLength: limit.maxWeighted, characterCountMode: "x_post" };
  }
  return { maxLength: limit.maxChars, characterCountMode: "raw" };
}

/** Maps stored `xAccounts.xSubscriptionType` to validation mode. */
export function inferPostLimitFromSubscriptionType(
  subscriptionType: string | undefined
): EffectivePostTextLimit {
  if (
    subscriptionType === "Basic" ||
    subscriptionType === "Premium" ||
    subscriptionType === "PremiumPlus"
  ) {
    return { mode: "long", maxChars: X_LONG_FORM_POST_MAX_CHARS };
  }
  return { mode: "short", maxWeighted: X_POST_WEIGHTED_MAX };
}

export function getXPostWeightedLength(text: string): number {
  return twitterText.getTweetLength(text);
}

/** Short-post only (280 weighted). */
export function getXPostTextLimitError(text: string): string | null {
  const len = getXPostWeightedLength(text);
  if (len <= X_POST_WEIGHTED_MAX) return null;
  return `Text exceeds X post limit (${len} weighted characters, max ${X_POST_WEIGHTED_MAX}). Shorten the text.`;
}

export function getPostTextLimitError(
  text: string,
  limit: EffectivePostTextLimit
): string | null {
  if (limit.mode === "short") {
    const len = getXPostWeightedLength(text);
    if (len <= limit.maxWeighted) return null;
    return `Text exceeds X post limit (${len} weighted characters, max ${limit.maxWeighted}). Shorten the text.`;
  }
  const len = text.length;
  if (len <= limit.maxChars) return null;
  return `Text exceeds X long-form limit (${len} characters, max ${limit.maxChars}). Shorten the text.`;
}

export function assertPostTextWithinLimit(
  text: string,
  limit: EffectivePostTextLimit
): void {
  const err = getPostTextLimitError(text, limit);
  if (err) throw new Error(err);
}

/** @deprecated Use assertPostTextWithinLimit with inferPostLimitFromSubscriptionType */
export function assertXPostTextWithinLimit(text: string): void {
  assertPostTextWithinLimit(text, {
    mode: "short",
    maxWeighted: X_POST_WEIGHTED_MAX,
  });
}

export function getDmTextLimitError(text: string): string | null {
  const len = text.length;
  if (len <= X_DM_TEXT_MAX) return null;
  return `DM text exceeds limit (${len} characters, max ${X_DM_TEXT_MAX}).`;
}

export function assertDmTextWithinLimit(text: string): void {
  const err = getDmTextLimitError(text);
  if (err) throw new Error(err);
}

const POST_LIKE_ACTIONS = new Set<string>(["reply_to_post", "create_post"]);

const DM_ACTIONS = new Set<string>([
  "send_dm",
  "send_dm_in_existing_conversation",
]);

/** True if a post/reply has non-empty text or at least one non-empty media URL. */
export function hasPostBody(
  text: string | undefined,
  mediaUrls: string[] | undefined
): boolean {
  const trimmed = text?.trim() ?? "";
  if (trimmed.length > 0) return true;
  const urls = mediaUrls?.filter(
    (u) => typeof u === "string" && u.trim().length > 0
  );
  return (urls?.length ?? 0) > 0;
}

/** True if DM has non-empty text or at least one non-empty media URL (X allows attachments-only DMs). */
export function hasDmBody(
  text: string | undefined,
  mediaUrls: string[] | undefined
): boolean {
  const trimmed = text?.trim() ?? "";
  if (trimmed.length > 0) return true;
  const urls = mediaUrls?.filter(
    (u) => typeof u === "string" && u.trim().length > 0
  );
  return (urls?.length ?? 0) > 0;
}

export function getTwitterActionTextValidationError(
  actionKey: string,
  text: string | undefined,
  limit: EffectivePostTextLimit,
  mediaUrls?: string[] | undefined
): string | null {
  const trimmed = text?.trim() ?? "";
  if (POST_LIKE_ACTIONS.has(actionKey)) {
    if (!hasPostBody(text, mediaUrls)) {
      return "Text or media is required for this action.";
    }
    return trimmed ? getPostTextLimitError(trimmed, limit) : null;
  }
  if (DM_ACTIONS.has(actionKey)) {
    if (!hasDmBody(text, mediaUrls)) {
      return "Text or media is required for this action.";
    }
    if (trimmed) {
      return getDmTextLimitError(trimmed);
    }
    return null;
  }
  return null;
}

export function assertTwitterActionTextValid(
  actionKey: string,
  text: string | undefined,
  limit: EffectivePostTextLimit,
  mediaUrls?: string[] | undefined
): void {
  const err = getTwitterActionTextValidationError(
    actionKey,
    text,
    limit,
    mediaUrls
  );
  if (err) throw new Error(err);
}
