export type UnipileWebhookCandidate = {
  id: string;
  source: string;
  requestUrl: string;
  enabled: boolean;
  events: string[];
};

export type UnipileWebhookReconciliationPlan = {
  keepWebhookId?: string;
  createReplacement: boolean;
  deleteWebhookIds: string[];
};

function hasSameEvents(actual: string[], expected: string[]) {
  if (actual.length !== expected.length) return false;
  const actualEvents = new Set(actual);
  return expected.every((event) => actualEvents.has(event));
}

/**
 * Reconciles only webhooks for this deployment's exact callback URL. Provider
 * credentials may be shared with another deployment, whose webhooks must stay
 * untouched.
 */
export function planUnipileWebhookReconciliation(
  webhooks: UnipileWebhookCandidate[],
  desired: {
    source: string;
    requestUrl: string;
    events: string[];
    storedWebhookId?: string;
  }
): UnipileWebhookReconciliationPlan {
  const scoped = webhooks.filter(
    (webhook) =>
      webhook.source === desired.source &&
      webhook.requestUrl === desired.requestUrl
  );
  const exact = scoped.filter(
    (webhook) =>
      webhook.enabled && hasSameEvents(webhook.events, desired.events)
  );
  const keep =
    exact.find((webhook) => webhook.id === desired.storedWebhookId) ?? exact[0];

  return {
    keepWebhookId: keep?.id,
    createReplacement: !keep,
    deleteWebhookIds: scoped
      .filter((webhook) => webhook.id !== keep?.id)
      .map((webhook) => webhook.id),
  };
}
