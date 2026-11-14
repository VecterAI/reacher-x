import { z } from "zod";
import type { BenchmarkTask } from "../../core/types";
import {
  type FilterField,
  type FilterSet,
  unexpressedFields,
} from "../filters";
import {
  companyEntity,
  joinText,
  personEntity,
  rankCandidates,
  text,
} from "./common";
import { callTreg, tregOutput } from "./treg";
import type { AdapterResult, SearchAdapter } from "./types";

const CONTACTS_DOCS =
  "https://docs.lusha.com/apis/openapi/prospecting/prospectingcontacts";
const COMPANIES_DOCS =
  "https://docs.lusha.com/apis/openapi/prospecting/prospectingcompanies";

/** "London, United Kingdom" becomes a city and country; a single part is a country. */
export function lushaLocation(value: string) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 2)
    return {
      city: parts[0],
      state: parts[1],
      country: parts[parts.length - 1],
    };
  return parts.length > 1
    ? { city: parts[0], country: parts[parts.length - 1] }
    : { country: parts[0] };
}

const sizes = (filters: FilterSet) =>
  filters.company.employeeRange
    ? [
        {
          ...(filters.company.employeeRange.min === null
            ? {}
            : { min: filters.company.employeeRange.min }),
          ...(filters.company.employeeRange.max === null
            ? {}
            : { max: filters.company.employeeRange.max }),
        },
      ]
    : [];

const nonEmpty = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) =>
      Array.isArray(item) ? item.length > 0 : item !== undefined && item !== ""
    )
  );

export const LUSHA_CONTACT_FIELDS: readonly FilterField[] = [
  "keywords",
  "person.titles",
  "person.locations",
  "company.locations",
  "company.employeeRange",
  "company.technologies",
  "signals.joinedNewEmployer",
  "signals.withinDays",
];

export const LUSHA_COMPANY_FIELDS: readonly FilterField[] = [
  "keywords",
  "company.locations",
  "company.industries",
  "company.employeeRange",
  "company.technologies",
];

export function lushaBody(
  task: BenchmarkTask,
  filters: FilterSet,
  size: number
) {
  const pagination = { page: 0, size: Math.max(10, size) };
  const companies = nonEmpty({
    locations: filters.company.locations.map(lushaLocation),
    sizes: sizes(filters),
    technologies: filters.company.technologies,
  });
  if (task.entityType === "organization")
    return {
      pagination,
      filters: {
        companies: {
          include: nonEmpty({
            ...companies,
            // Industry IDs need a lookup; their names join the search text instead.
            searchText: [
              ...filters.company.industries,
              ...filters.keywords,
            ].join(" "),
          }),
        },
      },
    };
  const since =
    filters.signals.joinedNewEmployer && filters.signals.withinDays
      ? new Date(
          Date.parse(task.referenceDate) -
            filters.signals.withinDays * 86_400_000
        )
          .toISOString()
          .slice(0, 10)
      : null;
  return {
    pagination,
    filters: {
      contacts: {
        include: nonEmpty({
          jobTitles: filters.person.titles,
          locations: filters.person.locations.map(lushaLocation),
          searchText: filters.keywords.join(" "),
          signals: since
            ? { types: ["companyChange"], startDate: since }
            : undefined,
        }),
      },
      ...(Object.keys(companies).length
        ? { companies: { include: companies } }
        : {}),
    },
  };
}

const loose = z.record(z.string(), z.unknown());
const asRecord = (value: unknown) => loose.catch({}).parse(value);
const rows = (value: unknown) =>
  z.array(z.unknown()).catch([]).parse(value).map(asRecord);

export const lushaAdapter: SearchAdapter = {
  id: "lusha",
  capabilities: {
    individual: { status: "supported", documentationUrl: CONTACTS_DOCS },
    organization: { status: "supported", documentationUrl: COMPANIES_DOCS },
  },
  async search(task, context) {
    const people = task.entityType === "individual";
    const endpoint = people ? "lusha.people.search" : "lusha.companies.search";
    const body = lushaBody(task, context.filters, context.topK);
    // Search results only; no contact reveal is requested.
    const result = await callTreg(context, { step: "search", endpoint, body });
    const found = rows(tregOutput(result.body).results);
    const candidates = rankCandidates(
      found.map((row, index) => {
        const location = asRecord(row.location);
        const where = joinText([
          location.city,
          location.state,
          location.country,
        ]);
        const linkedin = asRecord(row.socialLinks).linkedin;
        const company = asRecord(row.company);
        const employees = asRecord(row.employeeCount);
        return {
          sourceId: text(row.id) ?? `lusha-${index + 1}`,
          entity: people
            ? personEntity({
                name: joinText([row.firstName, row.lastName], " "),
                profileUrl: linkedin,
                title: asRecord(row.jobTitle).title,
                employer: company.name,
                location: where,
              })
            : companyEntity({
                name: row.name,
                profileUrl: linkedin,
                domain: row.domain,
                location: where,
                industry: row.industry,
                employeeCount: employees.exact,
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
        toolId: "lusha",
        taskId: task.id,
        endpoints: [endpoint],
        nativeFilters: body,
        unexpressed: unexpressedFields(
          context.filters,
          people ? LUSHA_CONTACT_FIELDS : LUSHA_COMPANY_FIELDS
        ),
        servedBy: Object.fromEntries(
          result.servedBy ? [["search", result.servedBy]] : []
        ),
        notes: ["Called through Treg. Locations split into city and country."],
      },
    } satisfies AdapterResult;
  },
};
