import Exa from "exa-js";

export type DescribeUrlResult =
  | {
      success: true;
      content: string;
      title?: string;
      source: "exa" | "html-fallback";
    }
  | {
      success: false;
      error: string;
    };

const MIN_CONTENT_LENGTH = 50;
const MAX_CONTENT_CHARS = 8000;
const REQUEST_TIMEOUT_MS = 12000;

function createExaClient(): Exa | null {
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new Exa(apiKey);
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  ) {
    return true;
  }

  if (
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  ) {
    return true;
  }

  return false;
}

function decodeHtmlEntities(value: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };

  return value.replace(/&[a-zA-Z0-9#]+;/g, (entity) => entities[entity] ?? " ");
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTagText(html: string, tagName: string): string | undefined {
  const match = html.match(
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i")
  );
  const text = match?.[1]
    ? collapseWhitespace(decodeHtmlEntities(match[1]))
    : "";
  return text || undefined;
}

function extractMetaContent(html: string, key: string): string | undefined {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["']`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const text = collapseWhitespace(decodeHtmlEntities(match[1]));
      if (text) {
        return text;
      }
    }
  }

  return undefined;
}

function htmlToPlainText(html: string): string {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ");

  const withBreaks = withoutNoise
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  const text = withBreaks
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ");

  return collapseWhitespace(decodeHtmlEntities(text));
}

function truncateContent(value: string): string {
  return value.length > MAX_CONTENT_CHARS
    ? value.slice(0, MAX_CONTENT_CHARS)
    : value;
}

async function tryDescribeWithExa(
  url: string
): Promise<DescribeUrlResult | null> {
  const exa = createExaClient();
  if (!exa) {
    return null;
  }

  try {
    const result = await exa.getContents([url], {
      text: true,
      livecrawl: "preferred",
    });

    const page = result.results?.[0];
    const text = page?.text ? collapseWhitespace(page.text) : "";
    if (text.length < MIN_CONTENT_LENGTH) {
      return null;
    }

    return {
      success: true,
      content: truncateContent(text),
      title: page?.title?.trim() || undefined,
      source: "exa",
    };
  } catch {
    return null;
  }
}

async function tryDescribeWithHtmlFetch(
  url: string
): Promise<DescribeUrlResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Website returned HTTP ${response.status}`,
      };
    }

    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml") &&
      !contentType.includes("text/plain")
    ) {
      return {
        success: false,
        error: `Unsupported content type: ${contentType || "unknown"}`,
      };
    }

    const raw = await response.text();
    const title =
      extractMetaContent(raw, "og:title") ?? extractTagText(raw, "title");
    const description =
      extractMetaContent(raw, "description") ??
      extractMetaContent(raw, "og:description") ??
      extractMetaContent(raw, "twitter:description");
    const bodyText = htmlToPlainText(raw);
    const combined = collapseWhitespace(
      [title, description, bodyText].filter(Boolean).join("\n\n")
    );

    if (combined.length < MIN_CONTENT_LENGTH) {
      return {
        success: false,
        error: "Could not extract sufficient content from URL",
      };
    }

    return {
      success: true,
      content: truncateContent(combined),
      title,
      source: "html-fallback",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: `Website timed out after ${REQUEST_TIMEOUT_MS}ms`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function validateDescribeUrlInput(input: string):
  | { ok: true; url: string }
  | {
      ok: false;
      error: string;
    } {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: "Invalid URL format" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only HTTP and HTTPS URLs are supported" };
  }

  if (isPrivateHostname(parsed.hostname)) {
    return {
      ok: false,
      error: "Local and private-network URLs are not supported",
    };
  }

  return { ok: true, url: parsed.toString() };
}

export async function describeUrl(url: string): Promise<DescribeUrlResult> {
  const validation = validateDescribeUrlInput(url);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  const exaResult = await tryDescribeWithExa(validation.url);
  if (exaResult?.success) {
    return exaResult;
  }

  return tryDescribeWithHtmlFetch(validation.url);
}
