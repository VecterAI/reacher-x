import { isRecord } from "./typeGuards";

export const X_DM_ACTIVITY_EVENT_TYPES = [
  "dm.sent",
  "dm.received",
  "dm.read",
  "chat.sent",
  "chat.received",
  "chat.conversation_join",
] as const;

export const X_POST_ACTIVITY_EVENT_TYPES = ["post.create"] as const;

export const X_ACTIVITY_EVENT_TYPES = [
  ...X_DM_ACTIVITY_EVENT_TYPES,
  ...X_POST_ACTIVITY_EVENT_TYPES,
] as const;

export type XDmActivityEventType = (typeof X_DM_ACTIVITY_EVENT_TYPES)[number];
export type XPostActivityEventType =
  (typeof X_POST_ACTIVITY_EVENT_TYPES)[number];
export type XActivityEventType = (typeof X_ACTIVITY_EVENT_TYPES)[number];
export type XActivityAuthMode = "app" | "user";

const textEncoder = new TextEncoder();

function getRequiredEnv(name: "X_API_BEARER_TOKEN"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set in the Convex environment.`);
  }
  return value;
}

/** OAuth 1.0 Consumer Secret (API Key Secret). Required for webhook CRC and POST signatures — not the OAuth 2.0 client secret. */
function getRequiredConsumerSecret(): string {
  const value = process.env.X_CONSUMER_SECRET?.trim();
  if (!value) {
    throw new Error(
      "X_CONSUMER_SECRET is not set in the Convex environment (OAuth 1.0 API Key Secret from X/Twitter Developer Portal)."
    );
  }
  return value;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function signWithConsumerSecret(input: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(getRequiredConsumerSecret()),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(input)
  );
  return bytesToBase64(new Uint8Array(signature));
}

type XWebhookRecord = {
  id: string;
  url: string;
  valid: boolean;
  createdAt?: string;
};

export type XActivitySubscriptionRecord = {
  subscriptionId: string;
  eventType: XActivityEventType;
  filterUserId?: string;
  webhookId?: string;
  tag?: string;
};

class XActivityRequestError extends Error {
  status: number;
  body: string;
  authMode: XActivityAuthMode;

  constructor(args: {
    status: number;
    body: string;
    authMode: XActivityAuthMode;
  }) {
    super(`X/Twitter Activity request failed (${args.status}): ${args.body}`);
    this.name = "XActivityRequestError";
    this.status = args.status;
    this.body = args.body;
    this.authMode = args.authMode;
  }
}

function getConvexSiteUrl(): string {
  const siteUrl = process.env.CONVEX_SITE_URL?.trim().replace(/\/$/, "");
  if (!siteUrl) {
    throw new Error("CONVEX_SITE_URL is not set in the Convex environment.");
  }
  return siteUrl;
}

function normalizeWebhook(
  input: Record<string, unknown>
): XWebhookRecord | null {
  const id = typeof input.id === "string" ? input.id : undefined;
  const url = typeof input.url === "string" ? input.url : undefined;
  const valid = typeof input.valid === "boolean" ? input.valid : undefined;
  if (!id || !url || typeof valid !== "boolean") {
    return null;
  }
  return {
    id,
    url,
    valid,
    createdAt:
      typeof input.created_at === "string" ? input.created_at : undefined,
  };
}

function normalizeSubscription(
  input: Record<string, unknown>
): XActivitySubscriptionRecord | null {
  const subscriptionId =
    typeof input.subscription_id === "string"
      ? input.subscription_id
      : typeof input.subscriptionId === "string"
        ? input.subscriptionId
        : undefined;
  const eventType =
    typeof input.event_type === "string"
      ? input.event_type
      : typeof input.eventType === "string"
        ? input.eventType
        : undefined;
  if (
    !subscriptionId ||
    !eventType ||
    !X_ACTIVITY_EVENT_TYPES.includes(eventType as XActivityEventType)
  ) {
    return null;
  }

  const filter = isRecord(input.filter) ? input.filter : undefined;
  return {
    subscriptionId,
    eventType: eventType as XActivityEventType,
    filterUserId:
      typeof filter?.user_id === "string"
        ? filter.user_id
        : typeof filter?.userId === "string"
          ? filter.userId
          : undefined,
    webhookId:
      typeof input.webhook_id === "string"
        ? input.webhook_id
        : typeof input.webhookId === "string"
          ? input.webhookId
          : undefined,
    tag: typeof input.tag === "string" ? input.tag : undefined,
  };
}

async function xActivityRequestWithBearer<T>(
  path: string,
  init?: RequestInit,
  args?: {
    bearerToken?: string;
    authMode?: XActivityAuthMode;
  }
): Promise<T> {
  const authMode = args?.authMode ?? "app";
  const bearer =
    args?.bearerToken?.trim() ?? getRequiredEnv("X_API_BEARER_TOKEN");
  const response = await fetch(`https://api.x.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const text = await response.text();
  const json = text ? (JSON.parse(text) as T) : ({} as T);
  if (!response.ok) {
    throw new XActivityRequestError({
      status: response.status,
      body: text || response.statusText,
      authMode,
    });
  }
  return json;
}

async function xActivityAppRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  return await xActivityRequestWithBearer(path, init, {
    bearerToken: getRequiredEnv("X_API_BEARER_TOKEN"),
    authMode: "app",
  });
}

async function xActivityUserRequest<T>(
  path: string,
  init: RequestInit | undefined,
  userOAuthBearer: string
): Promise<T> {
  return await xActivityRequestWithBearer(path, init, {
    bearerToken: userOAuthBearer,
    authMode: "user",
  });
}

function shouldRetryCreateWithUserAuth(error: unknown): boolean {
  if (!(error instanceof XActivityRequestError)) {
    return false;
  }
  const normalized = error.body.toLowerCase();
  return (
    error.authMode === "app" &&
    (normalized.includes("oauthaccesstokenrequired") ||
      normalized.includes("user context") ||
      normalized.includes("private events") ||
      normalized.includes("authorized your application"))
  );
}

export function getXWebhookCallbackUrl(): string {
  return `${getConvexSiteUrl()}/x-webhook`;
}

export async function buildXWebhookCrcResponse(
  crcToken: string
): Promise<string> {
  const digest = await signWithConsumerSecret(crcToken);
  return `sha256=${digest}`;
}

export async function verifyXWebhookSignature(
  payload: string,
  signatureHeader?: string | null
): Promise<boolean> {
  if (!signatureHeader) {
    return false;
  }
  const expected = `sha256=${await signWithConsumerSecret(payload)}`;
  return expected === signatureHeader;
}

export async function listXWebhooks(): Promise<XWebhookRecord[]> {
  const response = await xActivityAppRequest<{
    data?: Record<string, unknown>[];
  }>("/2/webhooks?webhook_config.fields=id,url,valid,created_at");
  return (response.data ?? [])
    .map((item) => normalizeWebhook(item))
    .filter((item): item is XWebhookRecord => Boolean(item));
}

export async function createXWebhook(url: string): Promise<XWebhookRecord> {
  const response = await xActivityAppRequest<Record<string, unknown>>(
    "/2/webhooks",
    {
      method: "POST",
      body: JSON.stringify({ url }),
    }
  );
  const webhook = normalizeWebhook(response);
  if (!webhook) {
    throw new Error("X/Twitter returned an invalid webhook response.");
  }
  return webhook;
}

export async function validateXWebhook(
  webhookId: string
): Promise<XWebhookRecord> {
  const response = await xActivityAppRequest<Record<string, unknown>>(
    `/2/webhooks/${webhookId}`,
    {
      method: "PUT",
    }
  );
  const webhook = normalizeWebhook(response);
  if (!webhook) {
    throw new Error(
      "X/Twitter returned an invalid webhook validation response."
    );
  }
  return webhook;
}

const MAX_X_ACTIVITY_SUBSCRIPTION_PAGES = 10;

/**
 * X Activity lists are paginated. Reconcile a bounded complete listing so a
 * duplicate that lives past the first page is found instead of retried forever.
 */
export async function listXActivitySubscriptions(): Promise<
  XActivitySubscriptionRecord[]
> {
  const subscriptions: XActivitySubscriptionRecord[] = [];
  const seenTokens = new Set<string>();
  let paginationToken: string | undefined;

  for (
    let pageNumber = 0;
    pageNumber < MAX_X_ACTIVITY_SUBSCRIPTION_PAGES;
    pageNumber += 1
  ) {
    const params = new URLSearchParams({ max_results: "100" });
    if (paginationToken) {
      params.set("pagination_token", paginationToken);
    }
    const response = await xActivityAppRequest<{
      data?: Record<string, unknown>[];
      meta?: { next_token?: string; nextToken?: string };
      next_token?: string;
      nextToken?: string;
    }>(`/2/activity/subscriptions?${params.toString()}`);
    subscriptions.push(
      ...(response.data ?? [])
        .map((item) => normalizeSubscription(item))
        .filter((item): item is XActivitySubscriptionRecord => Boolean(item))
    );

    const nextToken =
      typeof response.meta?.next_token === "string"
        ? response.meta.next_token
        : typeof response.meta?.nextToken === "string"
          ? response.meta.nextToken
          : typeof response.next_token === "string"
            ? response.next_token
            : typeof response.nextToken === "string"
              ? response.nextToken
              : undefined;
    if (!nextToken || seenTokens.has(nextToken)) {
      break;
    }
    seenTokens.add(nextToken);
    paginationToken = nextToken;
  }

  return subscriptions;
}

export async function updateXActivitySubscription(args: {
  subscriptionId: string;
  webhookId: string;
  tag: string;
}): Promise<XActivitySubscriptionRecord> {
  const response = await xActivityAppRequest<{
    data?: Record<string, unknown> | { subscription?: Record<string, unknown> };
  }>(`/2/activity/subscriptions/${args.subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({ webhook_id: args.webhookId, tag: args.tag }),
  });
  const data = response.data;
  const subscriptionPayload = isRecord(data)
    ? isRecord(data.subscription)
      ? data.subscription
      : data
    : undefined;
  const subscription = subscriptionPayload
    ? normalizeSubscription(subscriptionPayload)
    : null;
  if (!subscription) {
    throw new Error(
      "X/Twitter returned an invalid activity subscription update."
    );
  }
  return subscription;
}

export async function createXActivitySubscription(args: {
  eventType: XActivityEventType;
  xUserId: string;
  webhookId: string;
  tag: string;
  userOAuthAccessToken?: string;
}): Promise<{
  subscription: XActivitySubscriptionRecord;
  authMode: XActivityAuthMode;
}> {
  const requestInit = {
    method: "POST",
    body: JSON.stringify({
      event_type: args.eventType,
      filter: { user_id: args.xUserId },
      webhook_id: args.webhookId,
      tag: args.tag,
    }),
  } satisfies RequestInit;

  let response: {
    data?: {
      subscription?: Record<string, unknown>;
    };
  };
  let authMode: XActivityAuthMode = "app";
  try {
    response = await xActivityAppRequest(
      "/2/activity/subscriptions",
      requestInit
    );
  } catch (error) {
    if (
      !shouldRetryCreateWithUserAuth(error) ||
      !args.userOAuthAccessToken?.trim()
    ) {
      throw error;
    }
    response = await xActivityUserRequest(
      "/2/activity/subscriptions",
      requestInit,
      args.userOAuthAccessToken
    );
    authMode = "user";
  }
  const subscription = normalizeSubscription(
    response.data?.subscription ??
      (response.data as Record<string, unknown>) ??
      {}
  );
  if (!subscription) {
    throw new Error(
      "X/Twitter returned an invalid activity subscription response."
    );
  }
  return { subscription, authMode };
}
