import { z } from "zod";
import type { Exchange, HttpRequest } from "../../../core/calls/http";
import type { UsageUnits } from "../../../core/calls/rates";
import type { BenchmarkTask } from "../../../core/types";
import {
  companyEntity,
  count,
  joinText,
  linkedinUrl,
  personEntity,
  rankCandidates,
  requireOk,
  secret,
  text,
} from "../common";
import type { AdapterResult, SearchAdapter, SearchContext } from "../types";

/**
 * Treg relays each call to a provider and reports its price in micro-USD.
 * Routed calls also name the provider that served them and any filters it
 * ignored; both go into the receipt. https://treg.to/docs
 */
export const TREG_CALL = "https://treg.to/call/";
export const TREG_DOCS = "https://treg.to/docs";
// Round one's cap for one routed call; Treg answers 402 without charging above it.
export const ROUTE_MAX_COST_USD = "0.05";

export type TregCall = Readonly<{
  step: string;
  endpoint: string;
  body?: unknown;
  query?: HttpRequest["query"];
  routed?: boolean;
  // Non-secret provider headers Treg relays, such as an API version.
  headers?: Readonly<Record<string, string>>;
}>;

export async function callTreg(context: SearchContext, call: TregCall) {
  const exchange = await context.transport({
    step: call.step,
    method: "POST",
    url: `${TREG_CALL}${call.endpoint}`,
    body: call.body,
    query: call.query,
    headers: {
      ...call.headers,
      "X-Treg-Key-Protocol": "1",
      ...(call.routed ? { "X-Treg-Route-Max-Cost": ROUTE_MAX_COST_USD } : {}),
    },
    secretHeaders: { "X-Treg-Token": secret(context.secrets, "TREG_TOKEN") },
  });
  return { exchange, body: requireOk(exchange), ...tregMetadata(exchange) };
}

const header = (exchange: Exchange, name: string) =>
  Object.entries(exchange.response.headers).find(
    ([key]) => key.toLowerCase() === name
  )?.[1];

export function tregMetadata(exchange: Exchange) {
  const micro = header(exchange, "x-treg-cost-micro");
  return {
    usage: {
      provider: "treg",
      unit: "call",
      quantity: 1,
      reportedUsd:
        micro && /^\d+$/.test(micro) ? Number(micro) / 1_000_000 : null,
    } satisfies UsageUnits,
    servedBy: header(exchange, "x-treg-served-by") ?? null,
    ignoredFilters: header(exchange, "x-treg-ignored-filters") ?? null,
  };
}

/** Routed and relayed answers wrap the provider body in `output`. */
export function tregOutput(body: unknown): Record<string, unknown> {
  const record = z.record(z.string(), z.unknown()).catch({}).parse(body);
  const output = z
    .record(z.string(), z.unknown())
    .nullable()
    .catch(null)
    .parse(record.output);
  return output ?? record;
}

const loose = z.record(z.string(), z.unknown());
const asRecord = (value: unknown) => loose.catch({}).parse(value);
const rows = (value: unknown) =>
  z.array(z.unknown()).catch([]).parse(value).map(asRecord);

/**
 * Treg's own routed search. Rows keep the serving provider's shape, so common
 * field names are read defensively and the raw exchange is kept for review.
 */
export function parseTregRows(
  output: Record<string, unknown>,
  task: BenchmarkTask,
  retrievedAt: string,
  topK: number
) {
  const items = rows(
    task.entityType === "individual" ? output.people : output.companies
  );
  return rankCandidates(
    items.map((row, index) => {
      const urls = [row.linkedin_url, row.linkedin, row.profile_url, row.url];
      return {
        sourceId: text(row.id) ?? `treg-${index + 1}`,
        entity:
          task.entityType === "individual"
            ? personEntity({
                name: row.full_name ?? row.name,
                profileUrl: linkedinUrl(urls) ?? row.profile_url,
                title: row.title ?? row.headline,
                employer: row.company ?? row.company_name,
                location: row.location ?? joinText([row.city, row.country]),
                description: row.summary ?? row.headline,
              })
            : companyEntity({
                // Some providers keep the name elsewhere: Hunter in
                // organization, Exa in an entity or the page title.
                name:
                  row.name ??
                  row.company_name ??
                  row.organization ??
                  entityName(row) ??
                  row.title,
                profileUrl: linkedinUrl(urls) ?? row.website ?? row.domain,
                domain: row.domain ?? row.website ?? row.primary_domain,
                location: row.location ?? joinText([row.city, row.country]),
                industry: row.industry,
                employeeCount: count(row.employee_count ?? row.employees),
                description: row.description ?? row.summary,
              }),
      };
    }),
    retrievedAt,
    topK
  );
}

/** The first entity's name in an Exa-shaped row served through Treg. */
function entityName(row: Record<string, unknown>) {
  const [entity] = z.array(z.unknown()).catch([]).parse(row.entities);
  return text(asRecord(asRecord(entity).properties).name);
}

export const tregAdapter: SearchAdapter = {
  id: "treg",
  capabilities: {
    individual: { status: "supported", documentationUrl: TREG_DOCS },
    organization: { status: "supported", documentationUrl: TREG_DOCS },
  },
  async search(task, context) {
    const endpoint =
      task.entityType === "individual"
        ? "treg.people.search"
        : "treg.companies.search";
    const body = { q: task.prompt, limit: context.topK };
    const result = await callTreg(context, {
      step: "search",
      endpoint,
      body,
      routed: true,
    });
    return {
      candidates: parseTregRows(
        tregOutput(result.body),
        task,
        context.submittedAt,
        context.topK
      ),
      usage: [{ ...result.usage, provider: "treg" }],
      requestLatencyMs: result.exchange.latencyMs,
      completedAfterMs: result.exchange.latencyMs,
      exchanges: [result.exchange],
      modelCalls: [],
      receipt: {
        toolId: "treg",
        taskId: task.id,
        endpoints: [endpoint],
        nativeFilters: body,
        unexpressed: [],
        servedBy: Object.fromEntries(
          result.servedBy ? [["search", result.servedBy]] : []
        ),
        notes: result.ignoredFilters
          ? [`Treg reported ignored filters: ${result.ignoredFilters}`]
          : [],
      },
    } satisfies AdapterResult;
  },
};
