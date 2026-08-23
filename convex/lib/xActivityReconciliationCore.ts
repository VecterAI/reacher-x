export type XActivitySubscriptionCandidate<TEvent extends string = string> = {
  eventType: TEvent;
  filterUserId?: string;
  webhookId?: string;
  subscriptionId: string;
  tag?: string;
};

export type XWebhookCandidate = {
  id: string;
  url: string;
  valid: boolean;
};

/**
 * A webhook registered for another deployment must never be reported as this
 * deployment's realtime channel. Shared app credentials would otherwise make
 * dev look healthy while every event is delivered to production.
 */
export function findXWebhookForEnvironment(
  webhooks: XWebhookCandidate[],
  expectedUrl: string
): XWebhookCandidate | undefined {
  const exactMatch = webhooks.find((webhook) => webhook.url === expectedUrl);
  if (exactMatch) {
    return exactMatch;
  }
  if (webhooks.length > 0) {
    throw new Error(
      "X Activity is registered for a different deployment. Use a dedicated X app and webhook for this environment."
    );
  }
  return undefined;
}

export type XActivitySubscriptionCapability = "dm" | "post";
export type XActivitySubscriptionHealthStatus =
  | "unknown"
  | "healthy"
  | "degraded"
  | "pending_retry";

type XActivitySubscriptionHealthRecord = {
  dmActivitySubscriptionStatus?: XActivitySubscriptionHealthStatus;
  dmActivitySubscriptionsNextRetryAt?: number;
  dmActivitySubscriptionsLastError?: string;
  postActivitySubscriptionStatus?: XActivitySubscriptionHealthStatus;
  postActivitySubscriptionsNextRetryAt?: number;
  postActivitySubscriptionsLastError?: string;
};

/** Post monitoring health must never be treated as evidence that DMs are healthy. */
export function getXActivitySubscriptionHealth(
  account: XActivitySubscriptionHealthRecord,
  capability: XActivitySubscriptionCapability
) {
  return capability === "dm"
    ? {
        status: account.dmActivitySubscriptionStatus,
        nextRetryAt: account.dmActivitySubscriptionsNextRetryAt,
        lastError: account.dmActivitySubscriptionsLastError,
      }
    : {
        status: account.postActivitySubscriptionStatus,
        nextRetryAt: account.postActivitySubscriptionsNextRetryAt,
        lastError: account.postActivitySubscriptionsLastError,
      };
}

/**
 * Select an X Activity subscription by its immutable identity first. X's list
 * response may omit `webhook_id`, so webhook equality cannot be a requirement
 * for duplicate reconciliation.
 */
export function findMatchingXActivitySubscription<TEvent extends string>(
  subscriptions: XActivitySubscriptionCandidate<TEvent>[],
  args: {
    eventType: TEvent;
    xUserId: string;
    webhookId: string;
    expectedTag: string;
  }
): XActivitySubscriptionCandidate<TEvent> | undefined {
  const candidates = subscriptions.filter(
    (subscription) =>
      subscription.eventType === args.eventType &&
      subscription.filterUserId === args.xUserId
  );

  return (
    candidates.find(
      (subscription) => subscription.webhookId === args.webhookId
    ) ??
    candidates.find((subscription) => subscription.tag === args.expectedTag) ??
    candidates.find((subscription) => !subscription.webhookId) ??
    candidates[0]
  );
}

export function isDuplicateXActivitySubscriptionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    (normalized.includes("duplicate") && normalized.includes("subscription")) ||
    normalized.includes("subscription already exists")
  );
}
