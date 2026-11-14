import { z } from "zod";
import type { BenchmarkTask } from "../../core/types";
import {
  companyEntity,
  creditUsage,
  joinText,
  linkedinUrl,
  personEntity,
  rankCandidates,
  requireOk,
  secret,
  text,
} from "./common";
import type { AdapterResult, SearchAdapter, SearchContext } from "./types";

const ENDPOINT = "https://api.context.dev/v1/people/search";
const COMPANY_ENDPOINT = "https://api.context.dev/v1/company/search";
// Round one's mode; the frozen run settings record the mode actually used.
const MODE = "ultra";

const loose = z.record(z.string(), z.unknown());
const responseSchema = z.object({
  results: z.array(loose).default([]),
  key_metadata: z
    .object({ credits_consumed: z.number().nonnegative() })
    .partial()
    .optional(),
});
const asRecord = (value: unknown) => loose.catch({}).parse(value);
const asList = (value: unknown) => z.array(z.unknown()).catch([]).parse(value);

/**
 * context.dev's own relevance judgement (`match`) is not passed on: judges
 * see factual fields only.
 */
export function parseContextPeople(
  body: unknown,
  retrievedAt: string,
  topK: number
) {
  const { results } = responseSchema.parse(body);
  return rankCandidates(
    results.map((item, index) => {
      const role = asRecord(item.role);
      const location = asRecord(item.location);
      const profiles = asList(item.profiles);
      return {
        sourceId: text(item.id) ?? `context-${index + 1}`,
        entity: personEntity({
          name: item.name,
          profileUrl: linkedinUrl(profiles) ?? profiles.map(text).find(Boolean),
          title: role.title,
          employer: asRecord(role.company).name,
          location: joinText([
            location.city,
            location.region,
            location.country_code,
          ]),
          description: item.description,
        }),
      };
    }),
    retrievedAt,
    topK
  );
}

/** Company search returns headquarters, size, industries and funding. */
export function parseContextCompanies(
  body: unknown,
  retrievedAt: string,
  topK: number
) {
  const { results } = responseSchema.parse(body);
  return rankCandidates(
    results.map((item, index) => {
      const hq = asRecord(item.headquarters);
      const employees = asRecord(item.employees);
      return {
        sourceId: text(item.id) ?? text(item.domain) ?? `context-${index + 1}`,
        entity: companyEntity({
          name: item.name,
          profileUrl: asRecord(item.socials).linkedin ?? item.domain,
          domain: item.domain,
          location: joinText([hq.city, hq.region, hq.country_code]),
          industry: joinText(asList(item.industries)),
          employeeCount: employees.count,
          description: item.description,
        }),
      };
    }),
    retrievedAt,
    topK
  );
}

const DOCS = "https://docs.context.dev/api-reference";

export const contextAdapter: SearchAdapter = {
  id: "context",
  capabilities: {
    individual: {
      status: "supported",
      documentationUrl: `${DOCS}/people/search`,
    },
    organization: {
      status: "supported",
      documentationUrl: `${DOCS}/company/search`,
    },
  },
  async search(task: BenchmarkTask, context: SearchContext) {
    const people = task.entityType === "individual";
    const endpoint = people ? ENDPOINT : COMPANY_ENDPOINT;
    const body = { query: task.prompt, mode: MODE };
    const exchange = await context.transport({
      step: "search",
      method: "POST",
      url: endpoint,
      body,
      secretHeaders: {
        authorization: `Bearer ${secret(context.secrets, "CONTEXT_DEV_API_KEY")}`,
      },
      timeoutMs: 180_000,
    });
    const response = requireOk(exchange);
    const credits =
      responseSchema.parse(response).key_metadata?.credits_consumed;
    return {
      candidates: (people ? parseContextPeople : parseContextCompanies)(
        response,
        context.submittedAt,
        context.topK
      ),
      usage: [creditUsage("context.dev", credits)],
      requestLatencyMs: exchange.latencyMs,
      completedAfterMs: exchange.latencyMs,
      exchanges: [exchange],
      modelCalls: [],
      receipt: {
        toolId: "context",
        taskId: task.id,
        endpoints: [endpoint],
        nativeFilters: body,
        unexpressed: [],
        servedBy: {},
        notes: credits === undefined ? ["Credits used were not reported."] : [],
      },
    } satisfies AdapterResult;
  },
};
