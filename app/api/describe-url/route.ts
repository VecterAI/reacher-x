import { NextRequest, NextResponse } from "next/server";
import { streamText, generateText } from "ai";
import { createLLMModel } from "@/convex/lib/llmConfig";
import { logger } from "@/shared/lib/logger";
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils/validation";

export const runtime = "nodejs";

type ExaContentsResponse = {
  results?: Array<{
    text?: string;
    url?: string;
  }>;
};

type ExaSearchResponse = {
  results?: Array<{
    url?: string;
  }>;
};

function normalizeUrl(input: string): string {
  const raw = input.trim();
  const withProto = raw.startsWith("http") ? raw : `https://${raw}`;
  const u = new URL(withProto);
  u.hash = "";
  return u.toString();
}
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    // coarse 172.20–31
    (h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".localhost") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    h.startsWith("172.16.") ||
    h.startsWith("172.17.") ||
    h.startsWith("172.18.") ||
    h.startsWith("172.19.") || h.startsWith("172.2"))
  );
}
async function exaContents(url: string): Promise<string | null> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return null;
  let res = await fetch("https://api.exa.ai/contents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      urls: [url],
      text: true,
      livecrawl: "preferred",
      livecrawlTimeout: 10000,
      subpages: 0,
    }),
  });
  // Retry once with Authorization header if x-api-key failed (per Exa docs either is allowed)
  if (!res.ok) {
    try {
      res = await fetch("https://api.exa.ai/contents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          urls: [url],
          text: true,
          livecrawl: "preferred",
          livecrawlTimeout: 10000,
          subpages: 0,
        }),
      });
    } catch (e) {
      logger.error("[EXA] contents network error:", e);
      return null;
    }
  }
  if (!res.ok) {
    logger.warn("[EXA] contents non-OK status", {
      status: res.status,
      statusText: res.statusText,
    });
    return null;
  }
  const data: ExaContentsResponse | null = await res.json().catch(() => null);
  const text = data?.results?.[0]?.text;
  return text && text.trim().length > 0 ? text : null;
}

async function exaSearchBest(url: string): Promise<string | null> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return null;
  const domain = new URL(url).hostname;
  const query = `site:${domain} (about OR product OR pricing OR solutions OR overview)`;
  const searchRes = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ query, type: "neural", numResults: 3 }),
  });
  if (!searchRes.ok) return null;
  const data: ExaSearchResponse | null = await searchRes
    .json()
    .catch(() => null);
  const candidate = data?.results?.[0]?.url;
  if (!candidate) return null;
  return exaContents(candidate);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { url?: string };
    const inputUrl = body?.url;
    if (!inputUrl) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const normalized = normalizeUrl(inputUrl);
    const parsed = new URL(normalized);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      isBlockedHost(parsed.hostname)
    ) {
      return NextResponse.json({ error: "Unsupported URL" }, { status: 400 });
    }

    if (!process.env.EXA_API_KEY) {
      logger.error("[EXA] Missing EXA_API_KEY env var");
      return NextResponse.json(
        { error: "Server is misconfigured: missing EXA_API_KEY" },
        { status: 500 }
      );
    }

    logger.info("[/api/describe-url] fetching contents", { url: normalized });
    let text = await exaContents(normalized);
    if (!text || text.length < 200) {
      logger.info(
        "[/api/describe-url] contents sparse, trying search best subpage"
      );
      text = await exaSearchBest(normalized);
    }
    if (!text) {
      return NextResponse.json(
        {
          error:
            "Could not read content. Please write the description manually.",
        },
        { status: 422 }
      );
    }

    const maxChars = 8000;
    const input = text.length > maxChars ? text.slice(0, maxChars) : text;

    let modelToUse;
    let temperatureToUse = 0.4;
    try {
      const { model, temperature } = createLLMModel("workspace_description");
      modelToUse = model;
      temperatureToUse = temperature;
      logger.info(
        "[/api/describe-url] model resolved for workspace_description"
      );
    } catch (e) {
      logger.warn(
        "[/api/describe-url] workspace_description model failed, falling back to general",
        e
      );
      try {
        const { model, temperature } = createLLMModel("general");
        modelToUse = model;
        temperatureToUse = temperature;
        logger.info(
          "[/api/describe-url] successfully fell back to general model"
        );
      } catch (fallbackError) {
        logger.error(
          "[/api/describe-url] both workspace_description and general models failed",
          {
            workspaceDescriptionError:
              e instanceof Error ? e.message : String(e),
            generalError:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
            hasXAIKey: !!process.env.XAI_API_KEY,
            hasOpenAIKey: !!process.env.OPENAI_API_KEY,
          }
        );
        return NextResponse.json(
          {
            error: "LLM service is not configured. Please contact support.",
          },
          { status: 503 }
        );
      }
    }
    const system =
      "You are an expert potential customer finding AI agent for ReacherX. Your expertise lies in crafting concise, accurate descriptions of a provided URL so an AI can understand the user's product, service, or profile.";
    // Single source of truth for output character limit, with small headroom
    const OUTPUT_CHAR_LIMIT = Math.max(
      64,
      DESCRIPTION_CONSTRAINTS.MAX_LENGTH - 12
    );
    const prompt = [
      `URL: ${normalized}`,
      "From the page content below, write at most 3 crisp sentences.",
      `Strict hard limit: the ENTIRE output must be ≤ ${OUTPUT_CHAR_LIMIT} characters.`,
      `If needed, compress wording; do not exceed ${OUTPUT_CHAR_LIMIT} characters.`,
      "Return only the final text (no preamble or labels).",
      "Describe:",
      "- what it is (product/service/person),",
      "- who it's for,",
      "- the core problem/value.",
      "No CTAs/emojis. If a profile, describe expertise/services.",
      "",
      "Page content:",
      input,
    ].join("\n");

    // Support a non-streaming fallback mode for maximum robustness
    const mode = req.nextUrl.searchParams.get("mode");

    try {
      const tokenCap = Math.max(64, Math.ceil(OUTPUT_CHAR_LIMIT / 3));

      if (mode === "json") {
        const gen = await generateText({
          model: modelToUse,
          temperature: Math.min(0.5, Math.max(0.2, temperatureToUse)),
          maxOutputTokens: tokenCap,
          system,
          prompt,
        });
        return NextResponse.json(
          { text: gen.text },
          { status: 200, headers: { "Cache-Control": "no-store" } }
        );
      }

      const result = streamText({
        model: modelToUse,
        temperature: Math.min(0.5, Math.max(0.2, temperatureToUse)),
        maxOutputTokens: tokenCap,
        system,
        prompt,
      });

      // Bridge to plain text stream so the client can render token-by-token
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const delta of result.textStream) {
              controller.enqueue(encoder.encode(delta));
            }
          } catch (err) {
            logger.error(
              "[/api/describe-url] textStream iteration failed",
              err
            );
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      logger.error("[/api/describe-url] streamText failed", e);
      return NextResponse.json(
        {
          error:
            "LLM is temporarily unavailable. Please try again or write manually.",
        },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Unexpected error. Please write the description manually." },
      { status: 500 }
    );
  }
}
