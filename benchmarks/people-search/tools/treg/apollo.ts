import { z } from "zod";
import type { BenchmarkTask } from "../../../core/types";
import {
  type FilterField,
  type FilterSet,
  unexpressedFields,
} from "../../filters";
import {
  companyEntity,
  joinText,
  personEntity,
  rankCandidates,
  text,
} from "../common";
import { callTreg, TREG_DOCS } from "./treg";
import type { AdapterResult, SearchAdapter, SearchContext } from "../types";

const PEOPLE_DOCS = "https://docs.apollo.io/reference/people-api-search";
const COMPANY_DOCS = "https://docs.apollo.io/reference/organization-search";

const daysBefore = (referenceDate: string, days: number) =>
  new Date(Date.parse(referenceDate) - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

const employeeRange = (filters: FilterSet) => {
  const range = filters.company.employeeRange;
  return range ? [`${range.min ?? 1},${range.max ?? 1_000_000}`] : [];
};

// Industries have no free-text filter, so they join the keyword tags.
const keywordTags = (filters: FilterSet) => [
  ...filters.company.industries,
  ...filters.keywords,
];

const compact = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) =>
      Array.isArray(item) ? item.length > 0 : item !== undefined
    )
  );

export const APOLLO_PEOPLE_FIELDS: readonly FilterField[] = [
  "keywords",
  "person.titles",
  "person.seniorities",
  "person.locations",
  "company.locations",
  "company.industries",
  "company.employeeRange",
  "signals.hiringFor",
  "signals.withinDays",
];

/** Native people filters; unsupported fields are reported, never dropped silently. */
export function apolloPeopleFilters(
  filters: FilterSet,
  referenceDate: string,
  perPage: number
) {
  const hiringWindow =
    filters.signals.hiringFor.length && filters.signals.withinDays
      ? {
          "organization_job_posted_at_range[min]": daysBefore(
            referenceDate,
            filters.signals.withinDays
          ),
          "organization_job_posted_at_range[max]": referenceDate.slice(0, 10),
        }
      : {};
  return compact({
    person_titles: filters.person.titles,
    person_seniorities: filters.person.seniorities,
    person_locations: filters.person.locations,
    organization_locations: filters.company.locations,
    organization_num_employees_ranges: employeeRange(filters),
    q_keywords: keywordTags(filters).join(" ") || undefined,
    q_organization_job_titles: filters.signals.hiringFor,
    ...hiringWindow,
    page: 1,
    per_page: perPage,
  });
}

export const APOLLO_COMPANY_FIELDS: readonly FilterField[] = [
  "keywords",
  "company.locations",
  "company.industries",
  "company.employeeRange",
  "signals.fundingAnnounced",
  "signals.hiringFor",
  "signals.withinDays",
];

/** Organization search takes every parameter in the query string. */
export function apolloCompanyQuery(
  filters: FilterSet,
  referenceDate: string,
  perPage: number
) {
  const since = filters.signals.withinDays
    ? daysBefore(referenceDate, filters.signals.withinDays)
    : null;
  const query: Record<string, string | string[]> = {
    "organization_locations[]": filters.company.locations,
    "organization_num_employees_ranges[]": employeeRange(filters),
    "q_organization_keyword_tags[]": keywordTags(filters),
    "q_organization_job_titles[]": filters.signals.hiringFor,
    page: "1",
    per_page: String(perPage),
  };
  const until = referenceDate.slice(0, 10);
  if (since && filters.signals.fundingAnnounced) {
    query["latest_funding_date_range[min]"] = since;
    query["latest_funding_date_range[max]"] = until;
  }
  if (since && filters.signals.hiringFor.length) {
    query["organization_job_posted_at_range[min]"] = since;
    query["organization_job_posted_at_range[max]"] = until;
  }
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value.length > 0)
  );
}

const loose = z.record(z.string(), z.unknown());
const asRecord = (value: unknown) => loose.catch({}).parse(value);
const rows = (value: unknown) =>
  z.array(z.unknown()).catch([]).parse(value).map(asRecord);
const output = (body: unknown) => {
  const record = asRecord(body);
  return record.output ? asRecord(record.output) : record;
};

async function searchPeople(task: BenchmarkTask, context: SearchContext) {
  const filters = apolloPeopleFilters(
    context.filters,
    task.referenceDate,
    context.topK
  );
  const search = await callTreg(context, {
    step: "search",
    endpoint: "apollo.people.search",
    body: filters,
  });
  const found = rows(output(search.body).people).slice(0, context.topK);
  const steps = [search];
  // Apollo hides surnames and profiles; each person needs a paid lookup before judging.
  const people = [];
  for (const row of found) {
    const id = text(row.id);
    if (!id) continue;
    const enrich = await callTreg(context, {
      step: `enrich:${id}`,
      endpoint: "apollo.people.enrich",
      query: { id },
    });
    steps.push(enrich);
    const person = asRecord(output(enrich.body).person);
    const organization = asRecord(person.organization ?? row.organization);
    people.push({
      sourceId: id,
      entity: personEntity({
        name:
          person.name ??
          joinText([row.first_name, row.last_name_obfuscated], " "),
        profileUrl: person.linkedin_url,
        title: person.title ?? row.title,
        employer: organization.name,
        location: joinText([person.city, person.state, person.country]),
        description: person.headline,
      }),
    });
  }
  return {
    filters,
    steps,
    candidates: rankCandidates(people, context.submittedAt, context.topK),
  };
}

async function searchCompanies(task: BenchmarkTask, context: SearchContext) {
  const query = apolloCompanyQuery(
    context.filters,
    task.referenceDate,
    context.topK
  );
  const search = await callTreg(context, {
    step: "search",
    endpoint: "apollo.companies.search",
    query,
  });
  const found = rows(output(search.body).organizations);
  return {
    filters: query,
    steps: [search],
    candidates: rankCandidates(
      found.map((row, index) => ({
        sourceId: text(row.id) ?? `apollo-${index + 1}`,
        entity: companyEntity({
          name: row.name,
          profileUrl: row.linkedin_url ?? row.website_url,
          domain: row.primary_domain ?? row.website_url,
          location: joinText([row.city, row.state, row.country]),
          industry: row.industry,
          employeeCount: row.estimated_num_employees,
        }),
      })),
      context.submittedAt,
      context.topK
    ),
  };
}

export const apolloAdapter: SearchAdapter = {
  id: "apollo",
  capabilities: {
    individual: { status: "supported", documentationUrl: PEOPLE_DOCS },
    organization: { status: "supported", documentationUrl: COMPANY_DOCS },
  },
  async search(task, context) {
    const people = task.entityType === "individual";
    const { filters, steps, candidates } = people
      ? await searchPeople(task, context)
      : await searchCompanies(task, context);
    const latency = steps.reduce(
      (sum, step) => sum + step.exchange.latencyMs,
      0
    );
    return {
      candidates,
      usage: steps.map((step) => step.usage),
      requestLatencyMs: latency,
      // Lookups run one after another, so results are usable after all of them.
      completedAfterMs: latency,
      exchanges: steps.map((step) => step.exchange),
      modelCalls: [],
      receipt: {
        toolId: "apollo",
        taskId: task.id,
        endpoints: people
          ? ["apollo.people.search", "apollo.people.enrich"]
          : ["apollo.companies.search"],
        nativeFilters: filters,
        unexpressed: unexpressedFields(
          context.filters,
          people
            ? APOLLO_PEOPLE_FIELDS
            : // A funding signal is only expressed through its date window.
              APOLLO_COMPANY_FIELDS.filter(
                (field) =>
                  field !== "signals.fundingAnnounced" ||
                  context.filters.signals.withinDays !== null
              )
        ),
        servedBy: Object.fromEntries(
          steps.flatMap((step) =>
            step.servedBy ? [[step.exchange.step, step.servedBy]] : []
          )
        ),
        notes: [`Called through Treg (${TREG_DOCS}).`],
      },
    } satisfies AdapterResult;
  },
};
