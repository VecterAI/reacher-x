import { z } from "zod";
import type { Exchange } from "../../core/http";
import type { BenchmarkTask } from "../../core/types";
import {
  companyEntity,
  evidenceItem,
  joinText,
  personEntity,
  rankCandidates,
  requireOk,
  secret,
  text,
} from "./common";
import type { AdapterResult, SearchAdapter, SearchContext } from "./types";

const ENDPOINT = "https://api.exa.ai/search";
const TEXT_CHARS = 1_500;

const exaResponseSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())).default([]),
  costDollars: z.object({ total: z.number() }).partial().optional(),
});

const record = z.record(z.string(), z.unknown());
const asRecord = (value: unknown) => record.catch({}).parse(value);
const asList = (value: unknown) => z.array(z.unknown()).catch([]).parse(value);

/** Exa people results carry a person entity with work history; the page itself is the evidence. */
export function parseExaPeople(
  body: unknown,
  retrievedAt: string,
  topK: number
) {
  const { results } = exaResponseSchema.parse(body);
  return rankCandidates(
    results.map((item, index) => {
      const person = asList(item.entities)
        .map(asRecord)
        .find((entity) => entity.type === "person");
      const props = asRecord(person?.properties ?? person);
      // A role counts as current only when its dates show no end.
      const latest = asRecord(
        asList(props.workHistory ?? props.work_history)
          .map(asRecord)
          .find((role) => {
            const dates = asRecord(role.dates);
            return "dates" in role && !text(dates.to) && !text(dates.end);
          })
      );
      const company = latest.company;
      return {
        sourceId: text(item.id) ?? text(item.url) ?? `exa-${index + 1}`,
        entity: personEntity({
          name:
            props.name ??
            joinText([props.firstName, props.lastName], " ") ??
            item.author,
          profileUrl: item.url,
          title: latest.title,
          employer:
            typeof company === "object" && company !== null
              ? asRecord(company).name
              : company,
          location: joinText([props.location]),
          description: item.title,
          evidence: [
            evidenceItem(
              "exa-1",
              item.url,
              typeof item.text === "string"
                ? item.text.slice(0, TEXT_CHARS)
                : null,
              item.publishedDate,
              retrievedAt
            ),
          ],
        }),
      };
    }),
    retrievedAt,
    topK
  );
}

/** Exa company results carry a company entity; the result URL is the company's site. */
export function parseExaCompanies(
  body: unknown,
  retrievedAt: string,
  topK: number
) {
  const { results } = exaResponseSchema.parse(body);
  return rankCandidates(
    results.map((item, index) => {
      const company = asList(item.entities)
        .map(asRecord)
        .find((entity) => entity.type === "company");
      const props = asRecord(company?.properties ?? company);
      const headquarters = asRecord(props.headquarters);
      return {
        sourceId: text(item.id) ?? text(item.url) ?? `exa-${index + 1}`,
        entity: companyEntity({
          name: props.name ?? item.title,
          profileUrl: item.url,
          domain: item.url,
          location: joinText([headquarters.city, headquarters.country]),
          description: props.description ?? item.title,
          employeeCount: asRecord(props.workforce).total,
          evidence: [
            evidenceItem(
              "exa-1",
              item.url,
              typeof item.text === "string"
                ? item.text.slice(0, TEXT_CHARS)
                : null,
              item.publishedDate,
              retrievedAt
            ),
          ],
        }),
      };
    }),
    retrievedAt,
    topK
  );
}

/** Exa searches by the prompt itself, in its people or company category. */
export const exaAdapter: SearchAdapter = {
  id: "exa",
  capabilities: {
    individual: {
      status: "supported",
      documentationUrl: "https://docs.exa.ai/reference/search",
    },
    organization: {
      status: "supported",
      documentationUrl: "https://docs.exa.ai/reference/search",
    },
  },
  async search(task: BenchmarkTask, context: SearchContext) {
    const people = task.entityType === "individual";
    const body = {
      query: task.prompt,
      type: "auto",
      category: people ? "people" : "company",
      numResults: context.topK,
      contents: { text: { maxCharacters: TEXT_CHARS } },
    };
    const exchange: Exchange = await context.transport({
      step: "search",
      method: "POST",
      url: ENDPOINT,
      body,
      secretHeaders: { "x-api-key": secret(context.secrets, "EXA_API_KEY") },
    });
    const response = requireOk(exchange);
    const cost = exaResponseSchema.parse(response).costDollars?.total ?? null;
    return {
      candidates: (people ? parseExaPeople : parseExaCompanies)(
        response,
        context.submittedAt,
        context.topK
      ),
      usage: [
        { provider: "exa", unit: "request", quantity: 1, reportedUsd: cost },
      ],
      requestLatencyMs: exchange.latencyMs,
      completedAfterMs: exchange.latencyMs,
      exchanges: [exchange],
      modelCalls: [],
      receipt: {
        toolId: "exa",
        taskId: task.id,
        endpoints: [ENDPOINT],
        nativeFilters: body,
        // The prompt carries every requirement, but Exa's people and company
        // categories accept no date filter, so a signal window is not enforced.
        unexpressed:
          context.filters.signals.withinDays === null
            ? []
            : ["signals.withinDays"],
        servedBy: {},
        notes: [],
      },
    } satisfies AdapterResult;
  },
};
