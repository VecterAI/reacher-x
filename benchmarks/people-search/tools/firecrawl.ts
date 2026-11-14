import { z } from "zod";
import type { BenchmarkTask } from "../../core/types";
import {
  companyEntity,
  creditUsage,
  evidenceItem,
  linkedinUrl,
  personEntity,
  rankCandidates,
  requireOk,
  secret,
  text,
} from "./common";
import type { AdapterResult, SearchAdapter, SearchContext } from "./types";

const ENDPOINT = "https://api.firecrawl.dev/v2/search";

const searchResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z
    .object({
      web: z
        .array(
          z.object({
            url: z.string().optional(),
            title: z.string().nullish(),
            description: z.string().nullish(),
          })
        )
        .default([]),
    })
    .partial()
    .default({}),
  creditsUsed: z.number().nonnegative().optional(),
});

const nullableText = z.string().nullable();
const extractionSchema = z.object({
  results: z.array(
    z.object({
      result: z.number().int().positive(),
      name: z.string(),
      title: nullableText,
      employer: nullableText,
      location: nullableText,
      linkedinUrl: nullableText,
      domain: nullableText,
      industry: nullableText,
      description: nullableText,
    })
  ),
});

const SYSTEM = `You turn numbered web search results into records for a search benchmark.
For each result, identify the single main person or company the page is about, matching the requested type.
Use only the text given; never guess or add details. Use null for anything not stated.
Skip results that are not about one identifiable person or company of the requested type.
For a person, employer is their current company; domain and industry stay null.
For a company, title and employer stay null.`;

/**
 * Firecrawl searches the web with the prompt. Its results are pages, so one
 * recorded model call extracts the person or company each page is about.
 */
export const firecrawlAdapter: SearchAdapter = {
  id: "firecrawl",
  capabilities: {
    individual: {
      status: "supported",
      documentationUrl:
        "https://docs.firecrawl.dev/api-reference/endpoint/search",
    },
    organization: {
      status: "supported",
      documentationUrl:
        "https://docs.firecrawl.dev/api-reference/endpoint/search",
    },
  },
  async search(task: BenchmarkTask, context: SearchContext) {
    const body = { query: task.prompt, limit: context.topK };
    const exchange = await context.transport({
      step: "search",
      method: "POST",
      url: ENDPOINT,
      body,
      secretHeaders: {
        authorization: `Bearer ${secret(context.secrets, "FIRECRAWL_API_KEY")}`,
      },
    });
    const response = searchResponseSchema.parse(requireOk(exchange));
    const web = response.data.web ?? [];
    const usage: AdapterResult["usage"][number][] = [
      creditUsage("firecrawl", response.creditsUsed),
    ];
    const modelCalls: AdapterResult["modelCalls"][number][] = [];
    let candidates: AdapterResult["candidates"] = [];
    let extractionMs = 0;
    if (web.length) {
      const extraction = await context.model.call("extract", context.model.id, {
        system: SYSTEM,
        prompt: JSON.stringify({
          request: task.prompt,
          type: task.entityType === "individual" ? "person" : "company",
          results: web.map((item, index) => ({
            result: index + 1,
            title: item.title ?? null,
            url: item.url ?? null,
            description: item.description ?? null,
          })),
        }),
        schema: extractionSchema,
      });
      extractionMs = extraction.latencyMs;
      modelCalls.push({
        step: "extract",
        modelObserved: extraction.modelObserved,
        costUsd: extraction.costUsd,
      });
      usage.push({
        provider: "openrouter-harness",
        unit: "model-call",
        quantity: 1,
        reportedUsd: extraction.costUsd,
      });
      // At most one entity per page, in Firecrawl's order.
      const byResult = new Map<
        number,
        (typeof extraction.output.results)[number]
      >();
      for (const item of extraction.output.results)
        if (item.result <= web.length && !byResult.has(item.result))
          byResult.set(item.result, item);
      candidates = rankCandidates(
        [...byResult.entries()]
          .sort(([a], [b]) => a - b)
          .map(([index, item]) => {
            const page = web[index - 1];
            const evidence = [
              evidenceItem(
                "firecrawl-1",
                page.url,
                [page.title, page.description].filter(Boolean).join("\n"),
                null,
                context.submittedAt
              ),
            ];
            return {
              sourceId: text(page.url) ?? `result-${index}`,
              entity:
                task.entityType === "individual"
                  ? personEntity({
                      name: item.name,
                      profileUrl:
                        linkedinUrl([item.linkedinUrl, page.url]) ?? page.url,
                      title: item.title,
                      employer: item.employer,
                      location: item.location,
                      description: item.description,
                      evidence,
                    })
                  : companyEntity({
                      name: item.name,
                      profileUrl:
                        linkedinUrl([item.linkedinUrl, page.url]) ?? page.url,
                      domain: item.domain,
                      location: item.location,
                      industry: item.industry,
                      description: item.description,
                      evidence,
                    }),
            };
          }),
        context.submittedAt,
        context.topK
      );
    }
    return {
      candidates,
      usage,
      requestLatencyMs: exchange.latencyMs,
      completedAfterMs: exchange.latencyMs + extractionMs,
      exchanges: [exchange],
      modelCalls,
      receipt: {
        toolId: "firecrawl",
        taskId: task.id,
        endpoints: [ENDPOINT],
        nativeFilters: body,
        unexpressed: [],
        servedBy: {},
        notes: ["Entities extracted from search results by the harness model."],
      },
    } satisfies AdapterResult;
  },
};
