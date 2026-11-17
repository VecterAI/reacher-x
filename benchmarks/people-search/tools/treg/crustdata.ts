import { z } from "zod";
import type { BenchmarkTask } from "../../../core/types";
import {
  type FilterField,
  type FilterSet,
  unexpressedFields,
} from "../../setup/filters";
import { companyEntity, personEntity, rankCandidates, text } from "../common";
import { callTreg, tregOutput } from "./treg";
import type { AdapterResult, SearchAdapter } from "../types";

const PEOPLE_DOCS =
  "https://docs.crustdata.com/person-docs/search/introduction";
const COMPANY_DOCS =
  "https://docs.crustdata.com/company-docs/search/introduction";

/**
 * Indexed search only (proposal 2.2), never the real-time endpoints. Fields
 * are always listed, since a people search without them is billed for every
 * profile section. Field and filter names are checked in the smoke test.
 */
// Crustdata requires a dated API version on indexed search.
export const CRUSTDATA_API_VERSION = "2025-11-01";

const PEOPLE_RESPONSE_FIELDS = [
  "basic_profile",
  "social_handles",
  "experience.employment_details.current",
];
const COMPANY_RESPONSE_FIELDS = [
  "basic_info",
  "headcount",
  "funding",
  "locations",
  "taxonomy",
];

type Condition = { field: string; type: string; value: unknown };

export const CRUSTDATA_PEOPLE_FIELDS: readonly FilterField[] = [
  "keywords",
  "person.titles",
  "person.locations",
];

export const CRUSTDATA_COMPANY_FIELDS: readonly FilterField[] = [
  "keywords",
  "company.locations",
  "company.industries",
  "company.employeeRange",
  "company.fundingStages",
  "signals.fundingAnnounced",
  "signals.withinDays",
];

const searchText = (parts: readonly string[]) => parts.join(" ").trim();

export function crustdataBody(
  task: BenchmarkTask,
  filters: FilterSet,
  limit: number
) {
  if (task.entityType === "individual")
    return {
      // People filters stay in hybrid search text until field names are verified.
      search: {
        query: searchText([
          ...filters.person.titles,
          ...filters.person.locations,
          ...filters.keywords,
        ]),
        mode: "hybrid",
      },
      fields: PEOPLE_RESPONSE_FIELDS,
      limit,
    };
  const conditions: Condition[] = [];
  const range = filters.company.employeeRange;
  if (range?.min != null)
    conditions.push({ field: "headcount.total", type: "=>", value: range.min });
  if (range?.max != null)
    conditions.push({ field: "headcount.total", type: "=<", value: range.max });
  // Only "City, Country" values give a country to filter on. A single name may
  // be a city or a region such as Europe, so it joins the search text instead.
  const qualified = filters.company.locations.filter((location) =>
    location.includes(",")
  );
  const countries = qualified.map((location) =>
    location.split(",").at(-1)!.trim()
  );
  const places = filters.company.locations.map((location) =>
    location.includes(",")
      ? location.slice(0, location.lastIndexOf(",")).trim()
      : location
  );
  if (countries.length)
    conditions.push({
      field: "locations.country",
      type: "in",
      value: [...new Set(countries)],
    });
  if (filters.company.industries.length)
    conditions.push({
      field: "taxonomy.professional_network_industry",
      type: "in",
      value: filters.company.industries,
    });
  if (filters.company.fundingStages.length)
    conditions.push({
      field: "funding.last_round_type",
      type: "in",
      value: filters.company.fundingStages,
    });
  if (filters.signals.fundingAnnounced && filters.signals.withinDays) {
    conditions.push({
      field: "funding.last_fundraise_date",
      type: "=<",
      value: task.referenceDate.slice(0, 10),
    });
    conditions.push({
      field: "funding.last_fundraise_date",
      type: "=>",
      value: new Date(
        Date.parse(task.referenceDate) - filters.signals.withinDays * 86_400_000
      )
        .toISOString()
        .slice(0, 10),
    });
  }
  // Crustdata needs a filter or a query; with neither, the prompt is the query.
  const query =
    searchText([...places, ...filters.keywords]) ||
    (conditions.length ? "" : task.prompt);
  return {
    ...(conditions.length ? { filters: { op: "and", conditions } } : {}),
    ...(query ? { search: { query, mode: "hybrid" } } : {}),
    fields: COMPANY_RESPONSE_FIELDS,
    limit,
  };
}

const loose = z.record(z.string(), z.unknown());
const asRecord = (value: unknown) => loose.catch({}).parse(value);
const rows = (value: unknown) =>
  z.array(z.unknown()).catch([]).parse(value).map(asRecord);

export const crustdataAdapter: SearchAdapter = {
  id: "crustdata",
  capabilities: {
    individual: { status: "supported", documentationUrl: PEOPLE_DOCS },
    organization: { status: "supported", documentationUrl: COMPANY_DOCS },
  },
  async search(task, context) {
    const people = task.entityType === "individual";
    const endpoint = people
      ? "crustdata.people.search"
      : "crustdata.companies.search";
    const body = crustdataBody(task, context.filters, context.topK);
    const result = await callTreg(context, {
      step: "search",
      endpoint,
      body,
      headers: { "x-api-version": CRUSTDATA_API_VERSION },
    });
    const output = tregOutput(result.body);
    const candidates = rankCandidates(
      (people
        ? rows(output.profiles)
        : rows(output.companies ?? output.results)
      ).map((row, index) => {
        if (people) {
          const profile = asRecord(row.basic_profile);
          const current = asRecord(
            z
              .array(z.unknown())
              .catch([])
              .parse(
                asRecord(asRecord(row.experience).employment_details).current
              )[0]
          );
          return {
            sourceId:
              text(row.crustdata_person_id ?? row.id ?? row.person_id) ??
              `crustdata-${index + 1}`,
            entity: personEntity({
              name: profile.name,
              profileUrl: asRecord(
                asRecord(row.social_handles).professional_network_identifier
              ).profile_url,
              title: profile.current_title ?? current.title,
              employer: current.name,
              // Location arrives as an object with its raw text, or as plain text.
              location: asRecord(profile.location).raw ?? profile.location,
              description: profile.headline,
            }),
          };
        }
        const info = asRecord(row.basic_info);
        const headcount = asRecord(row.headcount);
        return {
          sourceId:
            text(row.crustdata_company_id ?? row.id ?? row.company_id) ??
            `crustdata-${index + 1}`,
          entity: companyEntity({
            name: info.name,
            profileUrl: info.primary_domain,
            domain: info.primary_domain,
            location: asRecord(row.locations).headquarters,
            industry: asRecord(row.taxonomy).professional_network_industry,
            employeeCount: headcount.total,
          }),
        };
      }),
      context.submittedAt,
      context.topK
    );
    return {
      candidates,
      usage: [result.usage],
      requestLatencyMs: result.exchange.latencyMs,
      completedAfterMs: result.exchange.latencyMs,
      exchanges: [result.exchange],
      modelCalls: [],
      receipt: {
        toolId: "crustdata",
        taskId: task.id,
        endpoints: [endpoint],
        nativeFilters: body,
        unexpressed: unexpressedFields(
          context.filters,
          people ? CRUSTDATA_PEOPLE_FIELDS : CRUSTDATA_COMPANY_FIELDS
        ),
        servedBy: Object.fromEntries(
          result.servedBy ? [["search", result.servedBy]] : []
        ),
        notes: [
          "Indexed search through Treg.",
          ...(people
            ? ["People requirements sent as hybrid search text."]
            : []),
        ],
      },
    } satisfies AdapterResult;
  },
};
