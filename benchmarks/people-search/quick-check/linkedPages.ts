import { z } from "zod";
import type { Transport } from "../../core/calls/http";
import { BudgetStop } from "../../core/execution/spend";
import type { LinkedPage } from "./deployment";

/**
 * Proposal 5.6: the text of linked pages is read once, with the benchmark's
 * Exa key, when the quick-check set is captured: at most two pages per
 * candidate (as qualification reads them) and at most $1.20 in total. Pages
 * become the `externalArticles` qualification receives, built the way
 * convex/lib/qualificationEvaluationCore.ts builds them.
 */

export const EXA_CONTENTS = "https://api.exa.ai/contents";
// convex/lib/researchCore.ts reads at most 1,200 characters per page.
export const LINKED_PAGE_CHARS = 1_200;

export type LinkedPageBudget = Readonly<{
  maxUsd: number;
  maxPagesPerCandidate: number;
  // Used before a request, and when Exa reports no cost: $1 per 1,000 pages
  // for text contents (exa.ai pricing).
  estimatedUsdPerPage: number;
}>;

export const QUICK_CHECK_PAGE_BUDGET: LinkedPageBudget = {
  maxUsd: 1.2,
  maxPagesPerCandidate: 2,
  estimatedUsdPerPage: 0.001,
};

export type ExternalArticle = Readonly<{
  sourcePostId: string;
  url: string;
  author: string;
  text: string;
}>;

const responseSchema = z.object({
  results: z
    .array(
      z.object({
        url: z.string(),
        text: z.string().nullish(),
        author: z.string().nullish(),
      })
    )
    .default([]),
  costDollars: z
    .object({ total: z.number().nonnegative() })
    .partial()
    .nullish(),
});

const normalizedUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export class LinkedPageReader {
  spentUsd = 0;
  pagesRequested = 0;
  requests = 0;
  failedRequests = 0;

  constructor(
    private readonly transport: Transport,
    private readonly apiKey: string,
    readonly budget: LinkedPageBudget = QUICK_CHECK_PAGE_BUDGET
  ) {
    if (!apiKey) throw new BudgetStop("EXA_API_KEY is not set.");
  }

  /**
   * Reads one candidate's linked pages. Stops before any request that could
   * pass the budget. A page without text or author yields no article, as in
   * qualification; a failed request yields none and is counted.
   */
  async read(
    step: string,
    pages: readonly LinkedPage[]
  ): Promise<ExternalArticle[]> {
    if (pages.length > this.budget.maxPagesPerCandidate)
      throw new BudgetStop(
        `A candidate may have at most ${this.budget.maxPagesPerCandidate} linked pages read.`
      );
    const readable = pages.flatMap((page) => {
      const url = normalizedUrl(page.url);
      return url ? [{ ...page, normalized: url }] : [];
    });
    if (readable.length === 0) return [];
    const estimate = readable.length * this.budget.estimatedUsdPerPage;
    if (this.spentUsd + estimate > this.budget.maxUsd)
      throw new BudgetStop(
        `Reading more linked pages would pass the $${this.budget.maxUsd.toFixed(2)} limit.`
      );
    this.requests += 1;
    this.pagesRequested += readable.length;
    const exchange = await this.transport({
      step,
      method: "POST",
      url: EXA_CONTENTS,
      body: {
        urls: readable.map((page) => page.normalized),
        text: { maxCharacters: LINKED_PAGE_CHARS },
      },
      secretHeaders: { "x-api-key": this.apiKey },
    });
    if (exchange.response.status < 200 || exchange.response.status >= 300) {
      this.failedRequests += 1;
      return [];
    }
    const body = responseSchema.parse(exchange.response.body);
    this.spentUsd += body.costDollars?.total ?? estimate;
    const byUrl = new Map(
      body.results.map((result) => [
        normalizedUrl(result.url) ?? result.url,
        result,
      ])
    );
    return readable.flatMap((page) => {
      const result = byUrl.get(page.normalized);
      const text = (result?.text ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, LINKED_PAGE_CHARS);
      const author = result?.author?.trim();
      if (!text || !author) return [];
      return page.sourcePostIds.map((sourcePostId) => ({
        sourcePostId,
        url: page.url,
        author,
        text,
      }));
    });
  }
}
