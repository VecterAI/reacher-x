export type OutreachRecoveryStage =
  | "detecting_outbound"
  | "awaiting_connection"
  | "awaiting_response";

export type OutreachRecoveryKind =
  | "twitter_manual_reply"
  | "linkedin_comment_reply"
  | "linkedin_connection_then_dm";

export function getRecoveryNextCheckDelayMs(
  stage: OutreachRecoveryStage,
  attemptCount: number,
  kind?: OutreachRecoveryKind
): number {
  if (stage === "awaiting_connection") {
    // Unipile's new_relation webhook is primary and may arrive up to 8 hours
    // after acceptance. Keep profile checks sparse to avoid automation-like
    // polling patterns on LinkedIn.
    if (attemptCount < 1) return 8 * 60 * 60 * 1000;
    if (attemptCount < 3) return 12 * 60 * 60 * 1000;
    if (attemptCount < 7) return 24 * 60 * 60 * 1000;
    return 72 * 60 * 60 * 1000;
  }

  if (stage === "awaiting_response") {
    if (attemptCount < 4) return 5 * 60 * 1000;
    if (attemptCount < 12) return 15 * 60 * 1000;
    return 30 * 60 * 1000;
  }

  // LinkedIn comment outbound detection still uses sparse polling.
  // X/Twitter manual-reply detecting_outbound is event-driven via X/Twitter
  // Activity (`post.create`); do not add SocialAPI poll intervals for that kind
  // here.
  void kind;
  if (attemptCount < 2) return 15 * 1000;
  if (attemptCount < 5) return 30 * 1000;
  if (attemptCount < 10) return 60 * 1000;
  if (attemptCount < 20) return 5 * 60 * 1000;
  return 15 * 60 * 1000;
}

export type ActivityCreatedPost = {
  postId: string;
  authorId?: string;
  text?: string;
  createdAtMs?: number;
  repliedToPostId?: string;
  conversationId?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function parseCreatedAtMs(value: unknown): number | undefined {
  const raw = asString(value);
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : undefined;
}

function extractRepliedToPostId(
  payload: Record<string, unknown>
): string | undefined {
  const referenced = payload.referenced_tweets;
  if (Array.isArray(referenced)) {
    for (const entry of referenced) {
      const record = asRecord(entry);
      if (!record) continue;
      const type = asString(record.type);
      if (type !== "replied_to") continue;
      const id = asString(record.id);
      if (id) return id;
    }
  }

  return (
    asString(payload.in_reply_to_status_id_str) ??
    asString(payload.in_reply_to_status_id) ??
    asString(payload.inReplyToTweetId)
  );
}

/**
 * Normalize an X/Twitter Activity `post.create` envelope/payload into the
 * fields we need to match a pending manual-reply recovery monitor.
 */
export function extractActivityCreatedPost(
  event: unknown
): ActivityCreatedPost | null {
  const envelope = asRecord(event);
  if (!envelope) return null;

  const payload = asRecord(envelope.payload) ?? envelope;
  const postId = asString(payload.id) ?? asString(payload.id_str);
  if (!postId) return null;

  return {
    postId,
    authorId:
      asString(payload.author_id) ??
      asString(payload.authorId) ??
      asString(asRecord(payload.user)?.id_str) ??
      asString(asRecord(payload.user)?.id),
    text: asString(payload.text) ?? asString(payload.full_text),
    createdAtMs: parseCreatedAtMs(payload.created_at ?? payload.createdAt),
    repliedToPostId: extractRepliedToPostId(payload),
    conversationId:
      asString(payload.conversation_id) ?? asString(payload.conversationId),
  };
}

/**
 * Returns true when an Activity post is a direct reply that can satisfy a
 * twitter_manual_reply monitor in detecting_outbound.
 */
export function matchesTwitterManualReplyRecovery(args: {
  post: ActivityCreatedPost;
  sourcePostId: string;
  connectedXUserId: string;
  startedAt: number;
}): boolean {
  if (!args.post.repliedToPostId) return false;
  if (args.post.repliedToPostId !== args.sourcePostId) return false;
  if (args.post.authorId !== args.connectedXUserId) {
    return false;
  }
  if (
    typeof args.post.createdAtMs === "number" &&
    args.post.createdAtMs + 60_000 < args.startedAt
  ) {
    return false;
  }
  return true;
}
