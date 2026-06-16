import { NextRequest, NextResponse } from "next/server";
import { describeUrl } from "@/shared/lib/urls/describeUrl";
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils";
import {
  generateTextWithJsonParse,
  robustGenerateObject,
} from "@/convex/lib/ai";
import { z } from "zod";
import { useLogger, withEvlog } from "@/shared/lib/logging/next";

type DescribeUrlBody = {
  url?: string;
};

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

export const POST = withEvlog(async (request: NextRequest) => {
  const log = useLogger();
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

  const result = await describeUrl(url);
  if (!result.success) {
    log.warn("describeUrl failed", {
      describe_url: {
        host: parsedUrl.hostname,
      },
      failure_reason: result.error,
    });
    return NextResponse.json(
      {
        success: false,
        error: result.error,
      },
      { status: 422 }
    );
  }

  const description = await summarizeUrlIntoDescription({
    url,
    title: result.title,
    content: result.content,
  });

  log.set({
    describe_url: {
      host: parsedUrl.hostname,
      source: result.source,
      title_present: Boolean(result.title),
    },
  });

  if (mode === "json") {
    return NextResponse.json(
      {
        success: true,
        text: description,
        title: result.title ?? null,
        source: result.source,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return new Response(description, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-URL-Source": result.source,
    },
  });
});
