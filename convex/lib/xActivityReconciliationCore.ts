export type XActivitySubscriptionCandidate<TEvent extends string = string> = {
  eventType: TEvent;
  filterUserId?: string;
  webhookId?: string;
  subscriptionId: string;
  tag?: string;
};

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
