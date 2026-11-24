import type { Exchange } from "../../../core/calls/http";
import type { StepCall } from "../../../core/calls/llm";
import type { BenchmarkTask } from "../../../core/types";
import type { FilterSet } from "../../../people-search/setup/filters";
import { toolCatalog } from "../../../people-search/tools/catalog";
import { apolloCompanyQuery } from "../../../people-search/tools/treg/apollo";
import {
  CRUSTDATA_API_VERSION,
  crustdataBody,
} from "../../../people-search/tools/treg/crustdata";
import { lushaBody } from "../../../people-search/tools/treg/lusha";
import { emptyFilters } from "../fixtures";

/**
 * Saved company-search responses for every adapter that supports
 * organizations, shaped like each provider's documented response. Every value
 * is synthetic: one invented company, "Northwind Example", returned by all
 * eight tools so cross-tool identity can be checked too.
 */

export const companyTask: BenchmarkTask = {
  id: "p17",
  prompt: "Synthetic company prompt",
  entityType: "organization",
  referenceDate: "2026-11-14T00:00:00Z",
  definitionNotes: [],
  criteria: [
    { id: "region", requirement: "Synthetic region", required: true },
    { id: "size", requirement: "Synthetic size", required: true },
  ],
};

export const companyFilters: FilterSet = {
  ...emptyFilters("organization"),
  company: {
    locations: ["Berlin, Germany"],
    industries: ["Software"],
    employeeRange: { min: 50, max: 200 },
    fundingStages: [],
    technologies: [],
  },
};

const NAME = "Northwind Example";
const DOMAIN = "northwind.example";
const LINKEDIN = "https://www.linkedin.com/company/northwind-example";

export type OrganizationFixture = Readonly<{
  topK: 5 | 10;
  secrets: Record<string, string>;
  exchanges: readonly Exchange[];
  // Saved outputs of the harness model calls some adapters make, by step.
  modelOutputs?: Readonly<Record<string, unknown>>;
  expected: Readonly<{
    domain: string;
    industry: string | null;
    employeeCount: number | null;
    location: string | null;
    // Absent when the provider returns no evidence of its own.
    evidencePublishedAt?: string | null;
  }>;
}>;

const topK = (id: string) =>
  toolCatalog.find((tool) => tool.id === id)!.judgedTopK;

const exchange = (
  step: string,
  request: Exchange["request"],
  body: unknown,
  headers: Record<string, string> = {}
): Exchange => ({
  step,
  request,
  response: { status: 200, body, headers },
  latencyMs: 100,
});

const TREG = "https://treg.to/call/";
const tregHeaders = { "X-Treg-Key-Protocol": "1" };
const CLAY = "https://api.clay.com/public/v0/search/query-mode";

export const organizationFixtures = {
  exa: {
    topK: topK("exa"),
    secrets: { EXA_API_KEY: "synthetic" },
    exchanges: [
      exchange(
        "search",
        {
          method: "POST",
          url: "https://api.exa.ai/search",
          body: {
            query: companyTask.prompt,
            type: "auto",
            category: "company",
            numResults: topK("exa"),
            contents: { text: { maxCharacters: 1500 } },
          },
        },
        {
          results: [
            {
              id: "exa-company-1",
              url: `https://${DOMAIN}/`,
              title: `${NAME} | Software`,
              text: "Synthetic company page.",
              publishedDate: "2026-09-01T00:00:00.000Z",
              entities: [
                {
                  type: "company",
                  properties: {
                    name: NAME,
                    description: "Synthetic software company.",
                    headquarters: { city: "Berlin", country: "Germany" },
                    workforce: { total: 120 },
                  },
                },
              ],
            },
          ],
          costDollars: { total: 0.007 },
        }
      ),
    ],
    // Exa's company entity carries no industry field.
    expected: {
      domain: DOMAIN,
      industry: null,
      employeeCount: 120,
      location: "Berlin, Germany",
      evidencePublishedAt: "2026-09-01T00:00:00.000Z",
    },
  },
  context: {
    topK: topK("context"),
    secrets: { CONTEXT_DEV_API_KEY: "synthetic" },
    exchanges: [
      exchange(
        "search",
        {
          method: "POST",
          url: "https://api.context.dev/v1/company/search",
          body: { query: companyTask.prompt, mode: "ultra" },
        },
        {
          results: [
            {
              id: "context-company-1",
              name: NAME,
              domain: DOMAIN,
              description: "Synthetic software company.",
              headquarters: { city: "Berlin", country_code: "DE" },
              employees: { count: 120 },
              industries: ["Software", "Fintech"],
              socials: { linkedin: LINKEDIN },
              match: { score: 0.9 },
            },
          ],
          key_metadata: { credits_consumed: 43 },
        }
      ),
    ],
    expected: {
      domain: DOMAIN,
      industry: "Software, Fintech",
      employeeCount: 120,
      location: "Berlin, DE",
    },
  },
  clay: {
    topK: topK("clay"),
    secrets: { CLAY_API_KEY: "synthetic" },
    exchanges: [
      exchange(
        "reference",
        { method: "GET", url: `${CLAY}/reference` },
        { reference: "Synthetic Clay query reference." }
      ),
      exchange(
        "create#1",
        {
          method: "POST",
          url: CLAY,
          body: { query: "synthetic companies query" },
        },
        { search_id: "search-1" }
      ),
      exchange(
        "run#1",
        {
          method: "POST",
          url: `${CLAY}/search-1/run`,
          body: { limit: topK("clay") },
        },
        {
          source_type: "companies",
          data: [
            {
              clay_company_id: "clay-company-1",
              name: NAME,
              domain: DOMAIN,
              linkedin_url: LINKEDIN,
              location: "Berlin, Germany",
              industry: "Software Development",
              size: 85,
              description: "Synthetic software company.",
            },
          ],
        }
      ),
    ],
    modelOutputs: { "query#1": { query: "synthetic companies query" } },
    expected: {
      domain: DOMAIN,
      industry: "Software Development",
      employeeCount: 85,
      location: "Berlin, Germany",
    },
  },
  firecrawl: {
    topK: topK("firecrawl"),
    secrets: { FIRECRAWL_API_KEY: "synthetic" },
    exchanges: [
      exchange(
        "search",
        {
          method: "POST",
          url: "https://api.firecrawl.dev/v2/search",
          body: { query: companyTask.prompt, limit: topK("firecrawl") },
        },
        {
          success: true,
          data: {
            web: [
              {
                url: `https://${DOMAIN}/about`,
                title: `About ${NAME}`,
                description: "Software company in Berlin.",
              },
            ],
          },
          creditsUsed: 2,
        }
      ),
    ],
    modelOutputs: {
      extract: {
        results: [
          {
            result: 1,
            name: NAME,
            title: null,
            employer: null,
            location: "Berlin, Germany",
            linkedinUrl: null,
            domain: DOMAIN,
            industry: "Software",
            description: "Software company in Berlin.",
          },
        ],
      },
    },
    // Search pages carry no date and the extraction gives no head count.
    expected: {
      domain: DOMAIN,
      industry: "Software",
      employeeCount: null,
      location: "Berlin, Germany",
      evidencePublishedAt: null,
    },
  },
  treg: {
    topK: topK("treg"),
    secrets: { TREG_TOKEN: "synthetic" },
    exchanges: [
      exchange(
        "search",
        {
          method: "POST",
          url: `${TREG}treg.companies.search`,
          body: { q: companyTask.prompt, limit: topK("treg") },
          headers: { ...tregHeaders, "X-Treg-Route-Max-Cost": "0.05" },
        },
        {
          output: {
            companies: [
              {
                id: "treg-company-1",
                name: NAME,
                domain: DOMAIN,
                industry: "Software",
                employee_count: 120,
                city: "Berlin",
                country: "Germany",
                linkedin_url: LINKEDIN,
              },
            ],
          },
        },
        { "x-treg-cost-micro": "7000", "x-treg-served-by": "provider-a" }
      ),
    ],
    expected: {
      domain: DOMAIN,
      industry: "Software",
      employeeCount: 120,
      location: "Berlin, Germany",
    },
  },
  apollo: {
    topK: topK("apollo"),
    secrets: { TREG_TOKEN: "synthetic" },
    exchanges: [
      exchange(
        "search",
        {
          method: "POST",
          url: `${TREG}apollo.companies.search`,
          query: apolloCompanyQuery(
            companyFilters,
            companyTask.referenceDate,
            topK("apollo")
          ),
          headers: tregHeaders,
        },
        {
          output: {
            organizations: [
              {
                id: "apollo-company-1",
                name: NAME,
                primary_domain: DOMAIN,
                website_url: `https://${DOMAIN}`,
                linkedin_url: LINKEDIN,
                city: "Berlin",
                country: "Germany",
                industry: "computer software",
                estimated_num_employees: 120,
              },
            ],
          },
        },
        { "x-treg-cost-micro": "0" }
      ),
    ],
    expected: {
      domain: DOMAIN,
      industry: "computer software",
      employeeCount: 120,
      location: "Berlin, Germany",
    },
  },
  lusha: {
    topK: topK("lusha"),
    secrets: { TREG_TOKEN: "synthetic" },
    exchanges: [
      exchange(
        "search",
        {
          method: "POST",
          url: `${TREG}lusha.companies.search`,
          body: lushaBody(companyTask, companyFilters, topK("lusha")),
          headers: tregHeaders,
        },
        {
          output: {
            results: [
              {
                id: "lusha-company-1",
                name: NAME,
                domain: DOMAIN,
                industry: "Software",
                employeeCount: { exact: 118 },
                location: { city: "Berlin", country: "Germany" },
                socialLinks: { linkedin: LINKEDIN },
              },
            ],
          },
        }
      ),
    ],
    expected: {
      domain: DOMAIN,
      industry: "Software",
      employeeCount: 118,
      location: "Berlin, Germany",
    },
  },
  crustdata: {
    topK: topK("crustdata"),
    secrets: { TREG_TOKEN: "synthetic" },
    exchanges: [
      exchange(
        "search",
        {
          method: "POST",
          url: `${TREG}crustdata.companies.search`,
          body: crustdataBody(companyTask, companyFilters, topK("crustdata")),
          headers: {
            "x-api-version": CRUSTDATA_API_VERSION,
            ...tregHeaders,
          },
        },
        {
          output: {
            companies: [
              {
                crustdata_company_id: 4242,
                basic_info: { name: NAME, primary_domain: DOMAIN },
                headcount: { total: 120 },
                locations: { headquarters: "Berlin, Germany" },
                taxonomy: {
                  professional_network_industry: "Software Development",
                },
              },
            ],
          },
        },
        { "x-treg-cost-micro": "9000" }
      ),
    ],
    expected: {
      domain: DOMAIN,
      industry: "Software Development",
      employeeCount: 120,
      location: "Berlin, Germany",
    },
  },
} as const satisfies Record<string, OrganizationFixture>;

/** Returns each step's saved output; any other step fails the test. */
export function savedModel(
  outputs: Readonly<Record<string, unknown>> = {}
): StepCall {
  return async (step, _model, request) => {
    if (!(step in outputs)) throw new Error(`Unexpected model call "${step}".`);
    return {
      output: request.schema.parse(outputs[step]),
      modelObserved: "synthetic/model-1",
      costUsd: 0.0001,
      latencyMs: 50,
    };
  };
}
