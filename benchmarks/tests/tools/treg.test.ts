import assert from "node:assert/strict";
import test from "node:test";
import { replayTransport, type Exchange } from "../../core/calls/http";
import type { BenchmarkTask } from "../../core/types";
import type { FilterSet } from "../../people-search/setup/filters";
import {
  apolloAdapter,
  apolloCompanyQuery,
  apolloPeopleFilters,
} from "../../people-search/tools/treg/apollo";
import { crustdataBody } from "../../people-search/tools/treg/crustdata";
import { lushaBody, lushaLocation } from "../../people-search/tools/treg/lusha";
import {
  parseTregRows,
  tregAdapter,
  tregMetadata,
} from "../../people-search/tools/treg/treg";
import { emptyFilters, fixtureContext } from "./fixtures";

// Synthetic tasks, filters and responses only.
const task = (entityType: FilterSet["entityType"]): BenchmarkTask => ({
  id: entityType === "individual" ? "7" : "13",
  prompt: "Synthetic prompt",
  entityType,
  referenceDate: "2026-11-14T00:00:00Z",
  definitionNotes: [],
  criteria: [{ id: "role", requirement: "Synthetic", required: true }],
});

const people: FilterSet = {
  ...emptyFilters("individual"),
  person: {
    titles: ["Software Engineer"],
    seniorities: ["senior"],
    locations: ["Austin, United States"],
    minYearsExperience: 5,
  },
  signals: {
    ...emptyFilters("individual").signals,
    joinedNewEmployer: true,
    withinDays: 90,
  },
};

const companies: FilterSet = {
  ...emptyFilters("organization"),
  company: {
    locations: ["Berlin, Germany"],
    industries: ["Fintech"],
    employeeRange: { min: 50, max: 200 },
    fundingStages: ["series_a"],
    technologies: [],
  },
  signals: {
    ...emptyFilters("organization").signals,
    fundingAnnounced: true,
    withinDays: 365,
  },
};

const exchange = (
  step: string,
  url: string,
  response: unknown,
  extra: Partial<Exchange["request"]> = {},
  headers: Record<string, string> = {}
): Exchange => ({
  step,
  request: {
    method: "POST",
    url,
    headers: { "X-Treg-Key-Protocol": "1" },
    ...extra,
  },
  response: { status: 200, body: response, headers },
  latencyMs: 100,
});

test("Treg cost, serving provider and ignored filters come from its headers", () => {
  const metadata = tregMetadata(
    exchange(
      "search",
      "https://treg.to/call/x",
      {},
      {},
      {
        "x-treg-cost-micro": "25000",
        "x-treg-served-by": "provider-b",
        "x-treg-ignored-filters": "location",
      }
    )
  );
  assert.deepEqual(metadata, {
    usage: { provider: "treg", unit: "call", quantity: 1, reportedUsd: 0.025 },
    servedBy: "provider-b",
    ignoredFilters: "location",
  });
});

test("Apollo filters map the shared set and the rest is recorded as unexpressed", async () => {
  assert.deepEqual(apolloPeopleFilters(people, "2026-11-14T00:00:00Z", 5), {
    person_titles: ["Software Engineer"],
    person_seniorities: ["senior"],
    person_locations: ["Austin, United States"],
    page: 1,
    per_page: 5,
  });
  assert.deepEqual(apolloCompanyQuery(companies, "2026-11-14T00:00:00Z", 5), {
    "organization_locations[]": ["Berlin, Germany"],
    "organization_num_employees_ranges[]": ["50,200"],
    "q_organization_keyword_tags[]": ["Fintech"],
    page: "1",
    per_page: "5",
    "latest_funding_date_range[min]": "2025-11-14",
    "latest_funding_date_range[max]": "2026-11-14",
  });

  const search = apolloPeopleFilters(people, "2026-11-14T00:00:00Z", 5);
  const transport = replayTransport([
    exchange(
      "search",
      "https://treg.to/call/apollo.people.search",
      {
        output: {
          people: [
            { id: "a1", first_name: "Syn", last_name_obfuscated: "T***" },
          ],
        },
      },
      { body: search }
    ),
    exchange(
      "enrich:a1",
      "https://treg.to/call/apollo.people.enrich",
      {
        output: {
          person: {
            name: "Syn Thetic",
            linkedin_url: "https://linkedin.com/in/syn",
            city: "Austin",
            country: "United States",
            title: "Engineer",
            organization: { name: "Example" },
          },
        },
      },
      { query: { id: "a1" } },
      { "x-treg-cost-micro": "26000" }
    ),
  ]);
  const result = await apolloAdapter.search(
    task("individual"),
    fixtureContext(transport, 5, { TREG_TOKEN: "synthetic" }, people)
  );
  assert.equal(result.candidates[0].entity.name, "Syn Thetic");
  assert.equal(result.completedAfterMs, 200);
  assert.deepEqual(result.receipt.unexpressed, [
    "person.minYearsExperience",
    "signals.withinDays",
    "signals.joinedNewEmployer",
  ]);
  assert.equal(result.usage[1].reportedUsd, 0.026);
});

test("Lusha and Crustdata bodies carry the shared filters in their native shapes", () => {
  assert.deepEqual(lushaLocation("London, United Kingdom"), {
    city: "London",
    country: "United Kingdom",
  });
  assert.deepEqual(lushaLocation("Portland, Maine, United States"), {
    city: "Portland",
    state: "Maine",
    country: "United States",
  });
  assert.deepEqual(
    crustdataBody(task("organization"), emptyFilters("organization"), 5).search,
    { query: "Synthetic prompt", mode: "hybrid" }
  );
  const lusha = lushaBody(task("individual"), people, 5);
  assert.deepEqual(lusha.pagination, { page: 0, size: 10 });
  assert.deepEqual(lusha.filters, {
    contacts: {
      include: {
        jobTitles: ["Software Engineer"],
        locations: [{ city: "Austin", country: "United States" }],
        signals: { types: ["companyChange"], startDate: "2026-08-16" },
      },
    },
  });
  const crust = crustdataBody(task("organization"), companies, 5);
  assert.deepEqual(crust.filters?.conditions, [
    { field: "headcount.total", type: "=>", value: 50 },
    { field: "headcount.total", type: "=<", value: 200 },
    { field: "locations.country", type: "in", value: ["Germany"] },
    {
      field: "taxonomy.professional_network_industry",
      type: "in",
      value: ["Fintech"],
    },
    { field: "funding.last_round_type", type: "in", value: ["series_a"] },
    { field: "funding.last_fundraise_date", type: "=<", value: "2026-11-14" },
    { field: "funding.last_fundraise_date", type: "=>", value: "2025-11-14" },
  ]);
  assert.deepEqual(crust.search, { query: "Berlin", mode: "hybrid" });
  assert.ok(crust.fields.length > 0);
});

test("Treg's routed company search records the provider that served it", async () => {
  const transport = replayTransport([
    exchange(
      "search",
      "https://treg.to/call/treg.companies.search",
      {
        output: {
          companies: [
            { name: "Example GmbH", domain: "example.de", employee_count: 120 },
          ],
        },
      },
      {
        body: { q: "Synthetic prompt", limit: 10 },
        headers: {
          "X-Treg-Key-Protocol": "1",
          "X-Treg-Route-Max-Cost": "0.05",
        },
      },
      { "x-treg-served-by": "provider-c" }
    ),
  ]);
  const result = await tregAdapter.search(
    task("organization"),
    fixtureContext(transport, 10, { TREG_TOKEN: "synthetic" }, companies)
  );
  assert.equal(result.candidates[0].entity.prospectType, "organization");
  assert.deepEqual(result.receipt.servedBy, { search: "provider-c" });
});

test("a company row in Exa's shape keeps its name when served through Treg", () => {
  const [company] = parseTregRows(
    {
      companies: [
        {
          title: "Page title",
          url: "https://vector.example",
          entities: [
            { type: "company", properties: { name: "Vector Example" } },
          ],
        },
      ],
    },
    task("organization"),
    "2026-11-14T00:00:00Z",
    5
  );
  assert.equal(company.entity.name, "Vector Example");
});
