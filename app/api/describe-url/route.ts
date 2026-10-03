import { NextRequest, NextResponse } from "next/server";
import { describeUrl } from "@/shared/lib/urls/describeUrl";
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils";
import {
  generateTextWithJsonParse,
  robustGenerateObject,
} from "@/convex/lib/ai";
import { z } from "zod";
import { useLogger, withEvlog } from "@/shared/lib/logging/next";
import {
  getClientIp,
  memoizeTtl,
  rateLimit,
} from "@/shared/lib/utils/core/publicApiGuardCore";

type DescribeUrlBody = {
  url?: string;
};

// The endpoint runs an Exa fetch plus an LLM call per unique URL, so both
// per-client traffic and repeat lookups for the same URL are bounded here.
const DESCRIBE_URL_RATE_LIMIT = { limit: 10, windowMs: 60_000 };
const DESCRIBE_URL_CACHE_TTL_MS = 60 * 60 * 1000;

const summarizedDescriptionSchema = z.object({
  description: z
    .string()
    .min(DESCRIPTION_CONSTRAINTS.MIN_LENGTH)
    .max(DESCRIPTION_CONSTRAINTS.MAX_LENGTH)
    .describe(
      `A plain-text business description under ${DESCRIPTION_CONSTRAINTS.MAX_LENGTH} characters with no markdown or quotes`
    ),
});

function getMode(request: NextRequest): "stream" | "json" {
  const mode = request.nextUrl.searchParams.get("mode");
  return mode === "json" ? "json" : "stream";
}

function sanitizeDescription(text: string): string {
  const normalized = text
    .replace(/[#*_`>()]|\[|\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > DESCRIPTION_CONSTRAINTS.MAX_LENGTH
    ? normalized.slice(0, DESCRIPTION_CONSTRAINTS.MAX_LENGTH).trim()
    : normalized;
}

function buildFallbackDescription(input: {
  title?: string;
  content: string;
}): string {
  const title = input.title ? sanitizeDescription(input.title) : "";
  const sentences = sanitizeDescription(input.content)
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 20);
  const body = sentences.slice(0, 2).join(" ");
  const combined = sanitizeDescription(
    [title, body].filter(Boolean).join(". ")
  );

  if (combined.length >= DESCRIPTION_CONSTRAINTS.MIN_LENGTH) {
    return combined;
  }

  return sanitizeDescription(input.content).slice(
    0,
    DESCRIPTION_CONSTRAINTS.MAX_LENGTH
  );
}

async function summarizeUrlIntoDescription(input: {
  url: string;
  title?: string;
  content: string;
}): Promise<string> {
  const prompt = `Write a concise business description for this website.

Website URL: ${input.url}
Page title: ${input.title ?? "Unknown"}
Extracted website content:
${input.content}

Requirements:
- plain text only
- no markdown
- no bullet points
- no quotes
- 1 short paragraph
- between ${DESCRIPTION_CONSTRAINTS.MIN_LENGTH} and ${DESCRIPTION_CONSTRAINTS.MAX_LENGTH} characters
- explain what the business/product does, who it helps, and the main outcome/value`;

  try {
    const { object } = await robustGenerateObject({
      operation: "summarizeUrlDescription",
      schema: summarizedDescriptionSchema,
      system:
        "You turn website content into a short, clear business description for an onboarding form.",
      prompt,
      temperature: 0.2,
      maxRetries: 2,
      routing: "fast",
    });

    return sanitizeDescription(object.description);
  } catch {
    try {
      const { object } = await generateTextWithJsonParse({
        operation: "summarizeUrlDescriptionFallback",
        schema: summarizedDescriptionSchema,
        system:
          "You turn website content into a short, clear business description for an onboarding form.",
        prompt,
        temperature: 0.2,
        routing: "fast",
      });

      return sanitizeDescription(object.description);
    } catch {
      return buildFallbackDescription(input);
    }
  }
}

type DescribeUrlOutcome = {
  description: string;
  title: string | null;
  source: "exa" | "html-fallback";
};

class DescribeUrlLookupError extends Error {
  constructor(public lookupError: string) {
    super(lookupError);
    this.name = "DescribeUrlLookupError";
  }
}

// One lookup plus summary per URL per TTL. Lookup failures throw so they are
// never cached and surface as 422 responses to the caller.
async function describeUrlOutcome(url: string): Promise<DescribeUrlOutcome> {
  const result = await describeUrl(url);
  if (!result.success) throw new DescribeUrlLookupError(result.error);
  const description = await summarizeUrlIntoDescription({
    url,
    title: result.title,
    content: result.content,
  });
  return { description, title: result.title ?? null, source: result.source };
}

export const POST = withEvlog(async (request: NextRequest) => {
  const log = useLogger();
  const limit = rateLimit(
    `describe-url:${getClientIp(request)}`,
    DESCRIBE_URL_RATE_LIMIT
  );
  if (!limit.allowed) {
    log.warn("describe-url rate limited", {
      describe_url: { retry_after_seconds: limit.retryAfterSeconds },
    });
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please try again shortly.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  let body: DescribeUrlBody;
  try {
    body = (await request.json()) as DescribeUrlBody;
  } catch {
    log.warn("Invalid describe-url JSON body");
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON body",
      },
      { status: 400 }
    );
  }

  const url = body.url?.trim();
  if (!url) {
    log.warn("Missing URL for describe-url request");
    return NextResponse.json(
      {
        success: false,
        error: "URL is required",
      },
      { status: 400 }
    );
  }

  const parsedUrl = new URL(url);
  const mode = getMode(request);
  log.set({
    describe_url: {
      host: parsedUrl.hostname,
      mode,
    },
    operation: "describe_url",
  });

  let outcome: DescribeUrlOutcome;
  try {
    outcome = await memoizeTtl(
      `describe-url:url:${url}`,
      DESCRIBE_URL_CACHE_TTL_MS,
      () => describeUrlOutcome(url)
    );
  } catch (error) {
    if (error instanceof DescribeUrlLookupError) {
      log.warn("describeUrl failed", {
        describe_url: {
          host: parsedUrl.hostname,
        },
        failure_reason: error.lookupError,
      });
      return NextResponse.json(
        {
          success: false,
          error: error.lookupError,
        },
        { status: 422 }
      );
    }
    throw error;
  }

  log.set({
    describe_url: {
      host: parsedUrl.hostname,
      source: outcome.source,
      title_present: Boolean(outcome.title),
    },
  });

  if (mode === "json") {
    return NextResponse.json(
      {
        success: true,
        text: outcome.description,
        title: outcome.title,
        source: outcome.source,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return new Response(outcome.description, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-URL-Source": outcome.source,
    },
  });
});
