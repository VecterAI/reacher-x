import { z } from "zod";

/**
 * Adapters talk to providers only through a Transport, so the same code runs
 * live, records what it saw, or replays saved exchanges in the $0 dry run.
 * Secrets travel in `secretHeaders`, which are sent but never recorded.
 */
export type HttpRequest = Readonly<{
  // Names this request within a unit of work, e.g. "search#1" or "enrich:<id>".
  step: string;
  method: "GET" | "POST";
  url: string;
  // Arrays repeat the key, as in `field[]=a&field[]=b`.
  query?: Readonly<Record<string, string | readonly string[]>>;
  body?: unknown;
  // Non-secret headers worth recording, such as a routing cost cap.
  headers?: Readonly<Record<string, string>>;
  secretHeaders?: Readonly<Record<string, string>>;
  timeoutMs?: number;
}>;

export const exchangeSchema = z.strictObject({
  step: z.string().min(1),
  request: z.strictObject({
    method: z.enum(["GET", "POST"]),
    url: z.string(),
    query: z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .optional(),
    body: z.unknown().optional(),
    headers: z.record(z.string(), z.string()).optional(),
  }),
  response: z.strictObject({
    status: z.number().int(),
    body: z.unknown(),
    // Only provider metadata headers (cost, routing, rate limits) are kept.
    headers: z.record(z.string(), z.string()),
  }),
  latencyMs: z.number().nonnegative(),
});
export type Exchange = z.infer<typeof exchangeSchema>;

export type Transport = (request: HttpRequest) => Promise<Exchange>;

const KEPT_RESPONSE_HEADER =
  /^(x-treg-|x-ratelimit-|ratelimit-|retry-after$|x-request-id$|x-credits-|x-cost)/i;
const DEFAULT_TIMEOUT_MS = 120_000;

function record(
  request: HttpRequest,
  response: Exchange["response"],
  latencyMs: number
): Exchange {
  return exchangeSchema.parse({
    step: request.step,
    request: {
      method: request.method,
      url: request.url,
      ...(request.query ? { query: { ...request.query } } : {}),
      ...(request.body === undefined ? {} : { body: request.body }),
      ...(request.headers ? { headers: { ...request.headers } } : {}),
    },
    response,
    latencyMs,
  });
}

/** Real HTTP. One attempt only: a paid request is never retried automatically. */
export function liveTransport(fetcher: typeof fetch = fetch): Transport {
  return async (request) => {
    const url = new URL(request.url);
    for (const [key, value] of Object.entries(request.query ?? {}))
      for (const item of typeof value === "string" ? [value] : value)
        url.searchParams.append(key, item);
    const started = performance.now();
    const response = await fetcher(url, {
      method: request.method,
      headers: {
        accept: "application/json",
        ...(request.body === undefined
          ? {}
          : { "content-type": "application/json" }),
        ...request.headers,
        ...request.secretHeaders,
      },
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: AbortSignal.timeout(request.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    const text = await response.text();
    const latencyMs = performance.now() - started;
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Keep a non-JSON body as text so the failure can be reviewed.
    }
    const headers = Object.fromEntries(
      [...response.headers.entries()].filter(([name]) =>
        KEPT_RESPONSE_HEADER.test(name)
      )
    );
    return record(
      request,
      { status: response.status, body, headers },
      latencyMs
    );
  };
}

/** Passes every exchange to `sink` (a private file writer) after it completes. */
export function recordingTransport(
  inner: Transport,
  sink: (exchange: Exchange) => Promise<void> | void
): Transport {
  return async (request) => {
    const exchange = await inner(request);
    await sink(exchange);
    return exchange;
  };
}

const requestKey = (request: Exchange["request"]) =>
  JSON.stringify([
    request.method,
    request.url,
    request.query ?? {},
    // An absent body and a JSON null body are different requests.
    "body" in request ? [request.body] : [],
    // Non-secret headers only; secrets are never recorded.
    request.headers ?? {},
  ]);

/**
 * Replays saved exchanges in order. A request that differs from the saved one
 * stops the dry run instead of silently answering with mismatched data.
 */
export function replayTransport(saved: readonly Exchange[]): Transport {
  const queue = saved.map((exchange) => exchangeSchema.parse(exchange));
  return async (request) => {
    const next = queue.shift();
    const expected = record(request, { status: 0, body: null, headers: {} }, 0);
    if (!next || next.step !== request.step)
      throw new Error(`No saved response for step "${request.step}".`);
    if (requestKey(next.request) !== requestKey(expected.request))
      throw new Error(
        `The saved request for step "${request.step}" differs from this one.`
      );
    return next;
  };
}
