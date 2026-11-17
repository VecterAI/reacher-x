import { z } from "zod";
import type { Exchange } from "../../../core/calls/http";
import type { BenchmarkTask } from "../../../core/types";
import {
  companyEntity,
  joinText,
  personEntity,
  ProviderError,
  rankCandidates,
  secret,
  text,
} from "../common";
import type { AdapterResult, SearchAdapter, SearchContext } from "../types";

const BASE = "https://api.clay.com/public/v0/search/query-mode";
const DOCS = "https://developers.clay.com/api-reference/search";

const querySchema = z.object({ query: z.string().min(1) });

const loose = z.record(z.string(), z.unknown());
const asRecord = (value: unknown) => loose.catch({}).parse(value);
const rows = (value: unknown) =>
  z.array(z.unknown()).catch([]).parse(value).map(asRecord);

const INSTRUCTIONS = `Write one Clay search query for the request below, using the reference above.
Select from people for a person request and from companies for a company request.
Express every filter given; do not add requirements and do not widen any of them.
Write every text value as a double-quoted string, in lists too: industry = "Software Development", country_name in ("United States", "Canada").
Return JSON {"query": "<the Clay query>"}.`;

/**
 * Clay's query language is documented in its own reference, so a recorded
 * model call writes the query from the frozen filters. If Clay rejects it,
 * one corrected query is tried with Clay's message; an empty result is
 * accepted as the answer rather than widened.
 */
export const clayAdapter: SearchAdapter = {
  id: "clay",
  capabilities: {
    individual: { status: "supported", documentationUrl: DOCS },
    organization: { status: "supported", documentationUrl: DOCS },
  },
  async search(task: BenchmarkTask, context: SearchContext) {
    const auth = { "clay-api-key": secret(context.secrets, "CLAY_API_KEY") };
    const exchanges: Exchange[] = [];
    const send = async (step: string, url: string, body?: unknown) => {
      const exchange = await context.transport({
        step,
        method: body === undefined ? "GET" : "POST",
        url,
        body,
        secretHeaders: auth,
      });
      exchanges.push(exchange);
      return exchange;
    };
    const reference = await send("reference", `${BASE}/reference`);
    const system = text(asRecord(reference.response.body).reference);
    if (reference.response.status !== 200 || !system)
      throw new ProviderError("Clay's query reference could not be read.");

    const modelCalls: AdapterResult["modelCalls"][number][] = [];
    const queries: string[] = [];
    let modelMs = 0;
    let rejection: string | null = null;
    let page: Exchange | null = null;
    for (const attempt of [1, 2]) {
      const written = await context.model.call(
        `query#${attempt}`,
        context.model.id,
        {
          system: `${system}\n\n${INSTRUCTIONS}`,
          prompt: JSON.stringify({
            request: task.prompt,
            type: task.entityType === "individual" ? "people" : "companies",
            referenceDate: task.referenceDate,
            filters: context.filters,
            limit: context.topK,
            ...(rejection
              ? { previousQuery: queries.at(-1), clayRejected: rejection }
              : {}),
          }),
          schema: querySchema,
        }
      );
      modelMs += written.latencyMs;
      modelCalls.push({
        step: `query#${attempt}`,
        modelObserved: written.modelObserved,
        costUsd: written.costUsd,
      });
      queries.push(written.output.query);
      const created = await send(`create#${attempt}`, BASE, {
        query: written.output.query,
      });
      const message = text(asRecord(created.response.body).message);
      if (created.response.status === 400 && attempt === 1 && message) {
        // Clay reports an unquoted text value only as an unexpected IDENT.
        rejection = `${message.slice(0, 500)}${
          /got IDENT/.test(message)
            ? " (a text value is probably unquoted: write it as a double-quoted string)"
            : ""
        }`;
        continue;
      }
      if (created.response.status !== 200)
        throw new ProviderError(
          `Clay create returned HTTP ${created.response.status}.`
        );
      const searchId = text(asRecord(created.response.body).search_id);
      if (!searchId) throw new ProviderError("Clay returned no search ID.");
      page = await send(`run#${attempt}`, `${BASE}/${searchId}/run`, {
        limit: context.topK,
      });
      if (page.response.status !== 200)
        throw new ProviderError(
          `Clay run returned HTTP ${page.response.status}.`
        );
      break;
    }
    if (!page) throw new ProviderError("Clay rejected both queries.");
    const body = asRecord(page.response.body);
    const expected = task.entityType === "individual" ? "people" : "companies";
    if (body.source_type !== expected)
      throw new ProviderError(
        `Clay returned ${String(body.source_type)}, not ${expected}.`
      );
    const found = rows(body.data);
    const candidates = rankCandidates(
      found.map((row, index) => {
        const location = asRecord(row.location);
        if (task.entityType === "individual") {
          const experiences = rows(row.matched_experiences);
          const current =
            // Only a current role is used; a past one is not today's employer.
            experiences.find((item) => item.is_current === true) ?? {};
          return {
            sourceId: text(row.clay_profile_id) ?? `clay-${index + 1}`,
            entity: personEntity({
              name: row.name ?? joinText([row.first_name, row.last_name], " "),
              profileUrl: row.linkedin_url,
              title: current.title,
              employer: current.company,
              location:
                location.name ??
                joinText([location.city, location.state_or_province]),
            }),
          };
        }
        return {
          sourceId: text(row.clay_company_id) ?? `clay-${index + 1}`,
          entity: companyEntity({
            name: row.name,
            profileUrl: row.linkedin_url ?? row.domain,
            domain: row.domain,
            location:
              typeof row.location === "string"
                ? row.location
                : joinText([row.country]),
            industry: row.industry,
            employeeCount: row.size,
            description: row.description,
          }),
        };
      }),
      context.submittedAt,
      context.topK
    );
    const latency = exchanges.reduce(
      (sum, exchange) => sum + exchange.latencyMs,
      0
    );
    return {
      candidates,
      usage: [
        {
          provider: "clay",
          unit: "result",
          quantity: found.length,
          reportedUsd: null,
        },
        ...modelCalls.map((call) => ({
          provider: "openrouter-harness",
          unit: "model-call",
          quantity: 1,
          reportedUsd: call.costUsd,
        })),
      ],
      requestLatencyMs: latency,
      completedAfterMs: latency + modelMs,
      exchanges,
      modelCalls,
      receipt: {
        toolId: "clay",
        taskId: task.id,
        endpoints: [BASE, `${BASE}/{search_id}/run`],
        nativeFilters: { queries },
        // The model expresses every filter in Clay's query; judges check the results.
        unexpressed: [],
        servedBy: {},
        notes: rejection ? [`Clay rejected the first query: ${rejection}`] : [],
      },
    } satisfies AdapterResult;
  },
};
