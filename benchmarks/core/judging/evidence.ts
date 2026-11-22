import { createHash } from "node:crypto";
import { z } from "zod";
import type { Exchange, Transport } from "../calls/http";
import { primaryIdentity } from "./identity";
import {
  evidenceSchema,
  type ArtifactReference,
  type BenchmarkEntity,
  type BenchmarkTask,
  type Evidence,
} from "../types";

export const MAX_EVIDENCE_SEARCHES_PER_ENTITY = 2;

/** Saved search responses, shared across tools so one search is never paid twice. */
export interface EvidenceCache {
  read(cacheKey: string): Promise<Exchange | null>;
  write(cacheKey: string, exchange: Exchange): Promise<ArtifactReference>;
}

export type CollectedEvidence = Readonly<{
  evidence: readonly Evidence[];
  // Paid searches in this call; cached answers are free.
  searchesUsed: 0 | 1 | 2;
  receipt: ArtifactReference;
}>;

export interface EvidenceProvider {
  collect(
    entity: BenchmarkEntity,
    task: BenchmarkTask
  ): Promise<CollectedEvidence>;
}

const TAVILY_SEARCH = "https://api.tavily.com/search";
const QUERY_CHARS = 380;

const tavilyResponseSchema = z.object({
  results: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().nullish(),
        content: z.string().nullish(),
        published_date: z.string().nullish(),
      })
    )
    .default([]),
});

const clip = (value: string) =>
  Array.from(value.replace(/\s+/g, " ").trim()).slice(0, QUERY_CHARS).join("");

/** One query to confirm who the result is, one aimed at the prompt's requirements. */
export function evidenceQueries(entity: BenchmarkEntity, task: BenchmarkTask) {
  const context =
    entity.prospectType === "individual"
      ? [entity.employer, entity.title]
      : [entity.domain, entity.location];
  const identity = clip(
    [`"${entity.name}"`, ...context].filter(Boolean).join(" ")
  );
  const requirements = task.criteria
    .filter((criterion) => criterion.required)
    .map((criterion) => criterion.requirement)
    .join("; ");
  return [identity, clip(`"${entity.name}" ${requirements}`)];
}

/**
 * Tavily web evidence for the judges (proposal 3.3): basic depth, three
 * results per search, publication dates requested so freshness can be read.
 * The generated answer summary is never requested; judges see sources only.
 */
export function tavilyEvidence(options: {
  transport: Transport;
  apiKey: string;
  cache: EvidenceCache;
  retrievedAt: () => string;
}): EvidenceProvider {
  return {
    async collect(entity, task) {
      const identity = primaryIdentity(entity) ?? entity.name;
      let searchesUsed = 0;
      const evidence: Evidence[] = [];
      const receipts: ArtifactReference[] = [];
      for (const [index, query] of evidenceQueries(entity, task).entries()) {
        const body = {
          query,
          search_depth: "basic",
          max_results: 3,
          include_answer: false,
          include_published_date: true,
        };
        const key = createHash("sha256")
          .update(JSON.stringify([identity, body]))
          .digest("hex");
        let exchange = await options.cache.read(key);
        if (!exchange) {
          exchange = await options.transport({
            step: `evidence#${index + 1}`,
            method: "POST",
            url: TAVILY_SEARCH,
            body,
            secretHeaders: { authorization: `Bearer ${options.apiKey}` },
          });
          searchesUsed += 1;
          if (exchange.response.status !== 200)
            throw new Error(
              `Evidence search returned HTTP ${exchange.response.status}.`
            );
        }
        receipts.push(await options.cache.write(key, exchange));
        const { results } = tavilyResponseSchema.parse(exchange.response.body);
        for (const result of results) {
          const parsed = evidenceSchema.safeParse({
            id: `web-${evidence.length + 1}`,
            url: result.url,
            text: [result.title, result.content].filter(Boolean).join("\n"),
            publishedAt: Number.isFinite(
              Date.parse(result.published_date ?? "")
            )
              ? new Date(Date.parse(result.published_date!)).toISOString()
              : null,
            retrievedAt: options.retrievedAt(),
          });
          if (parsed.success && parsed.data.text) evidence.push(parsed.data);
        }
      }
      return {
        evidence,
        searchesUsed: searchesUsed as 0 | 1 | 2,
        // The second search's receipt; both are stored under the run's private folder.
        receipt: receipts[receipts.length - 1],
      };
    },
  };
}
