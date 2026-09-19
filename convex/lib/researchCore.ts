/**
 * Deep research core (Layer 3) built on Exa.
 *
 * Runs neural web searches with content extraction so the △ Agent can
 * research prospects and companies before generating or refining plans.
 * The Exa SDK uses a browser-compatible fetch implementation, so this module
 * intentionally stays importable from Convex's default runtime.
 */

import Exa from "exa-js";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { acquireExaApiBudget } from "./exaApiBudget";
import {
  EXA_CONTENT_COST_PER_PAGE_USD,
  EXA_SEARCH_COST_PER_REQUEST_USD,
  trackProviderRequest,
} from "./providerReliability";
import {
  describeUrlWithHtmlFallback,
  validateDescribeUrlInput,
} from "../../shared/lib/urls/describeUrl";

const MAX_QUERIES = 4;
const RESULTS_PER_QUERY = 4;
const SNIPPET_MAX_CHARS = 1200;
const REACHERX_BLOG_INDEX_URL = "https://www.reacherx.com/blog/sitemap.md";
const REACHERX_BLOG_INDEX_LINE =
  /^- \[([^\]]+)\]\((https?:\/\/(?:www\.)?reacherx\.com\/blog\/[^)]+)\/markdown\):\s*(.+)$/i;
const REACHERX_BLOG_STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "me",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "what",
  "which",
  "with",
]);

let exaClient: Exa | null = null;

function getExaClient(): Exa {
  if (!exaClient) {
    const apiKey = process.env.EXA_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "EXA_API_KEY is not configured. Set it via `npx convex env set`."
      );
    }
    exaClient = new Exa(apiKey);
  }
  return exaClient;
}

export interface ResearchFinding {
  title: string;
  url: string;
  publishedDate?: string;
  snippet: string;
}

export interface ResearchQueryOutcome {
  query: string;
  findings: ResearchFinding[];
  error?: string;
}

export interface WebPageReadOutcome {
  url: string;
  title: string;
  snippet: string;
  author?: string;
  error?: string;
}

export type ResearchProviderContext = {
  ctx: ActionCtx;
  consumer: string;
  workspaceId?: Id<"workspaces">;
  prospectId?: Id<"prospects">;
  autoPlanRunId?: Id<"autoPlanRuns">;
};

export type WebSearchOptions = {
  maxResults?: number;
  maxCharacters?: number;
  includeDomains?: string[];
};

/** Parse the public first-party blog index without importing the Next app. */
export function parseReacherXBlogIndex(markdown: string): ResearchFinding[] {
  return markdown.split(/\r?\n/).flatMap((line) => {
    const match = line.match(REACHERX_BLOG_INDEX_LINE);
    if (!match) return [];

    const [, title, markdownUrl, snippet] = match;
    return [
      {
        title: title.trim(),
        url: markdownUrl.replace(/\/markdown\/?$/i, ""),
        snippet: snippet.trim().slice(0, SNIPPET_MAX_CHARS),
      },
    ];
  });
}

/** Rank first-party blog entries against a natural-language request. */
export function rankReacherXBlogResults(
  query: string,
  findings: ResearchFinding[],
  maxResults = RESULTS_PER_QUERY
): ResearchFinding[] {
  const terms = query
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 3 && !REACHERX_BLOG_STOP_WORDS.has(term));
  if (!terms.length) return [];

  return findings
    .map((finding) => {
      const title = finding.title.toLocaleLowerCase("en");
      const searchable = `${title} ${finding.snippet}`
        .toLocaleLowerCase("en")
        .replace(/[^a-z0-9]+/g, " ");
      const score = terms.reduce((total, term) => {
        const stem =
          term.length > 4 && term.endsWith("ies")
            ? `${term.slice(0, -3)}y`
            : term.length > 4 && term.endsWith("s")
              ? term.slice(0, -1)
              : term;
        if (title.includes(term)) return total + 5;
        if (searchable.includes(` ${term} `)) return total + 3;
        if (stem !== term && searchable.includes(` ${stem} `)) return total + 2;
        return total;
      }, 0);

      return { finding, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.finding.title.localeCompare(b.finding.title)
    )
    .slice(0, Math.min(Math.max(maxResults, 1), RESULTS_PER_QUERY))
    .map(({ finding }) => finding);
}

/** Search the published ReacherX blog index before falling back to Exa. */
export async function searchReacherXBlog(
  query: string,
  providerContext: ResearchProviderContext,
  options: WebSearchOptions = {}
): Promise<ResearchFinding[]> {
  try {
    const response = await fetch(REACHERX_BLOG_INDEX_URL, {
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) {
      const matches = rankReacherXBlogResults(
        query,
        parseReacherXBlogIndex(await response.text()),
        options.maxResults
      );
      if (matches.length > 0) return matches;
    }
  } catch {
    // Exa remains the fallback when the first-party index is unavailable.
  }

  return searchWeb(query, providerContext, {
    ...options,
    includeDomains: ["reacherx.com"],
  });
}

/** Run one bounded Exa search through the shared provider budget. */
export async function searchWeb(
  query: string,
  providerContext: ResearchProviderContext,
  options: WebSearchOptions = {}
): Promise<ResearchFinding[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  const maxResults = Math.min(
    Math.max(options.maxResults ?? RESULTS_PER_QUERY, 1),
    RESULTS_PER_QUERY
  );
  const maxCharacters = Math.min(
    Math.max(options.maxCharacters ?? SNIPPET_MAX_CHARS, 400),
    2400
  );
  const exa = getExaClient();

  const response = await trackProviderRequest({
    ctx: providerContext.ctx,
    provider: "exa",
    request: {
      consumer: providerContext.consumer,
      endpoint: "/search",
      workspaceId: providerContext.workspaceId,
      prospectId: providerContext.prospectId,
      autoPlanRunId: providerContext.autoPlanRunId,
    },
    execute: async () => {
      await acquireExaApiBudget(providerContext.ctx, providerContext.consumer);
      return await exa.search(normalizedQuery, {
        type: "auto",
        numResults: maxResults,
        ...(options.includeDomains?.length
          ? { includeDomains: options.includeDomains }
          : {}),
        contents: { text: { maxCharacters } },
      });
    },
    estimateUsage: (result) => {
      const billableUnits = result.results?.length ?? 0;
      return {
        billableUnits,
        estimatedCostUsd:
          EXA_SEARCH_COST_PER_REQUEST_USD +
          billableUnits * EXA_CONTENT_COST_PER_PAGE_USD,
      };
    },
  });

  return (response.results ?? []).map((result) => ({
    title: result.title?.trim() || result.url,
    url: result.url,
    publishedDate: result.publishedDate ?? undefined,
    snippet: (result.text ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxCharacters),
  }));
}

/** Read clean page text directly from known URLs already stored on a profile. */
export async function readWebPages(
  urls: string[],
  providerContext: ResearchProviderContext
): Promise<WebPageReadOutcome[]> {
  const limitedUrls = [
    ...new Set(urls.flatMap((url) => (url.trim() ? [url.trim()] : []))),
  ].slice(0, 2);

  if (limitedUrls.length === 0) {
    return [];
  }

  const validations = limitedUrls.map((url) => ({
    url,
    validation: validateDescribeUrlInput(url),
  }));
  const invalidUrls = new Map(
    validations
      .filter(({ validation }) => !validation.ok)
      .map(({ url, validation }) => [
        url,
        validation.ok ? "" : validation.error,
      ])
  );
  const safeUrlByRawUrl = new Map(
    validations
      .filter(({ validation }) => validation.ok)
      .map(({ url, validation }) => [url, validation.ok ? validation.url : ""])
  );
  const safeUrls = [...safeUrlByRawUrl.values()];
  if (safeUrls.length === 0) {
    return limitedUrls.map((url) => ({
      url,
      title: url,
      snippet: "",
      error: invalidUrls.get(url) ?? "Unable to validate URL",
    }));
  }

  try {
    const exa = getExaClient();
    const response = await trackProviderRequest({
      ctx: providerContext.ctx,
      provider: "exa",
      request: {
        consumer: providerContext.consumer,
        endpoint: "/contents",
        workspaceId: providerContext.workspaceId,
        prospectId: providerContext.prospectId,
        autoPlanRunId: providerContext.autoPlanRunId,
      },
      execute: async () => {
        await acquireExaApiBudget(
          providerContext.ctx,
          providerContext.consumer
        );
        return await exa.getContents(safeUrls, {
          text: { maxCharacters: SNIPPET_MAX_CHARS },
        });
      },
      estimateUsage: (result) => {
        const billableUnits = result.results?.length ?? 0;
        return {
          billableUnits,
          estimatedCostUsd: billableUnits * EXA_CONTENT_COST_PER_PAGE_USD,
        };
      },
    });

    const resultsByUrl = new Map(
      (response.results ?? []).map((result) => [result.url, result])
    );

    return await Promise.all(
      limitedUrls.map(async (url) => {
        const invalidError = invalidUrls.get(url);
        if (invalidError) {
          return {
            url,
            title: url,
            snippet: "",
            error: invalidError,
          };
        }

        const normalizedUrl = safeUrlByRawUrl.get(url) ?? url;
        const result = resultsByUrl.get(normalizedUrl) ?? resultsByUrl.get(url);
        const snippet = (result?.text ?? "").replace(/\s+/g, " ").trim();
        if (snippet) {
          return {
            url,
            title: result?.title?.trim() || url,
            snippet: snippet.slice(0, SNIPPET_MAX_CHARS),
            author: result?.author?.trim() || undefined,
          };
        }

        const fallback = await describeUrlWithHtmlFallback(url);
        return fallback.success
          ? {
              url,
              title: fallback.title?.trim() || url,
              snippet: fallback.content.slice(0, SNIPPET_MAX_CHARS),
              author: fallback.author,
            }
          : {
              url,
              title: url,
              snippet: "",
              error: fallback.error,
            };
      })
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Website read failed";
    return await Promise.all(
      limitedUrls.map(async (url) => {
        const invalidError = invalidUrls.get(url);
        if (invalidError) {
          return {
            url,
            title: url,
            snippet: "",
            error: invalidError,
          };
        }

        const fallback = await describeUrlWithHtmlFallback(url);
        return fallback.success
          ? {
              url,
              title: fallback.title?.trim() || url,
              snippet: fallback.content.slice(0, SNIPPET_MAX_CHARS),
              author: fallback.author,
            }
          : {
              url,
              title: url,
              snippet: "",
              error: `${errorMessage}; ${fallback.error}`,
            };
      })
    );
  }
}

/**
 * Run up to MAX_QUERIES Exa searches in parallel, each returning extracted
 * page text. A failing query degrades to an error entry instead of failing
 * the whole batch.
 */
export async function runDeepResearch(
  queries: string[],
  providerContext: ResearchProviderContext
): Promise<ResearchQueryOutcome[]> {
  const limited = queries
    .map((query) => query.trim())
    .filter(Boolean)
    .slice(0, MAX_QUERIES);

  const outcomes: ResearchQueryOutcome[] = [];
  for (const query of limited) {
    try {
      outcomes.push({
        query,
        findings: await searchWeb(query, providerContext),
      });
    } catch (error) {
      outcomes.push({
        query,
        findings: [],
        error: error instanceof Error ? error.message : "Search failed",
      });
      break;
    }
  }
  return outcomes;
}
