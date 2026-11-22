import { createHash } from "node:crypto";
import {
  exchangeSchema,
  type HttpRequest,
  type Transport,
} from "../../core/calls/http";
import type { StructuredCall } from "../../core/calls/llm";
import type { JudgeCaller } from "../../core/judging/judges";
import type { FilterSet } from "../setup/filters";
import { taskId } from "../setup/criteria";
import { peopleSearchPlan } from "../setup/plan";

/**
 * Synthetic stand-ins for every provider the benchmark calls, for the $0 dry
 * run: competitor search APIs, Tavily, the account balance endpoints, the
 * harness model and the judges. Names, links and text are invented; links
 * use reserved example domains or made-up profile slugs. Spending is tracked
 * on the synthetic accounts so the spend guard and reports have numbers.
 */

export class SyntheticAccounts {
  openRouterUsage = 0;
  openRouterCredits = 60;
  // SocialAPI reports its balance in US cents.
  socialApiCents = 10_000;
  renidlyCredits = 3_000;
  tregBalance = 40;
}

const RESULTS = 10;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const number = (value: string) => parseInt(hash(value).slice(0, 8), 16);

/** The prompt a request is about, so tools return overlapping people for the same prompt. */
function keyOf(request: HttpRequest) {
  const text = JSON.stringify([request.body ?? null, request.query ?? null]);
  const prompt = peopleSearchPlan.prompts.find((item) =>
    text.includes(item.text)
  );
  return prompt ? taskId(prompt.id) : `q${hash(text).slice(0, 6)}`;
}

const isCompanyPrompt = (key: string) =>
  peopleSearchPlan.prompts.some(
    (prompt) =>
      taskId(prompt.id) === key &&
      peopleSearchPlan.categories[prompt.category].entityType === "organization"
  );

const personFor = (slug: string) => ({
  slug,
  name: `Synthetic Person ${slug}`,
  linkedin: `https://www.linkedin.com/in/synthetic-${slug}`,
  title: "Engineer",
  company: "Example Labs",
  city: "London",
  country: "United Kingdom",
});

const companyFor = (slug: string) => ({
  slug,
  name: `Synthetic Company ${slug}`,
  domain: `${slug}.example`,
  linkedin: `https://www.linkedin.com/company/synthetic-${slug}`,
  city: "London",
  country: "United Kingdom",
  industry: "Software",
  employees: 150,
});

const slugs = (key: string) =>
  Array.from({ length: RESULTS }, (_, index) => `${key}-${index + 1}`);
const people = (key: string) => slugs(key).map(personFor);
const companies = (key: string) => slugs(key).map(companyFor);

type Answer = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

function treg(
  endpoint: string,
  request: HttpRequest,
  key: string,
  accounts: SyntheticAccounts
): Answer {
  const charge = (usd: number, servedBy?: string): Answer["headers"] => {
    accounts.tregBalance -= usd;
    return {
      "x-treg-cost-micro": String(Math.round(usd * 1_000_000)),
      ...(servedBy ? { "x-treg-served-by": servedBy } : {}),
    };
  };
  const person = people(key);
  const company = companies(key);
  switch (endpoint) {
    case "apollo.people.search":
      return {
        status: 200,
        body: {
          output: {
            people: person.map((item) => ({
              id: `apollo-${item.slug}`,
              first_name: "Synthetic",
              last_name_obfuscated: "P***",
              title: item.title,
            })),
          },
        },
        headers: charge(0),
      };
    case "apollo.people.enrich": {
      const id = request.query?.id;
      const item = personFor(String(id ?? "unknown").replace(/^apollo-/, ""));
      return {
        status: 200,
        body: {
          output: {
            person: {
              name: item.name,
              linkedin_url: item.linkedin,
              title: item.title,
              city: item.city,
              country: item.country,
              organization: { name: item.company },
            },
          },
        },
        headers: charge(0.026),
      };
    }
    case "apollo.companies.search":
      return {
        status: 200,
        body: {
          output: {
            organizations: company.map((item) => ({
              id: `apollo-${item.slug}`,
              name: item.name,
              linkedin_url: item.linkedin,
              primary_domain: item.domain,
              city: item.city,
              country: item.country,
              industry: item.industry,
              estimated_num_employees: item.employees,
            })),
          },
        },
        headers: charge(0),
      };
    case "lusha.people.search":
    case "lusha.companies.search":
      return {
        status: 200,
        body: {
          output: {
            results:
              endpoint === "lusha.people.search"
                ? person.map((item) => ({
                    id: `lusha-${item.slug}`,
                    firstName: "Synthetic",
                    lastName: `Person ${item.slug}`,
                    jobTitle: { title: item.title },
                    company: { name: item.company },
                    location: { city: item.city, country: item.country },
                    socialLinks: { linkedin: item.linkedin },
                  }))
                : company.map((item) => ({
                    id: `lusha-${item.slug}`,
                    name: item.name,
                    domain: item.domain,
                    location: { city: item.city, country: item.country },
                    industry: item.industry,
                    employeeCount: { exact: item.employees },
                    socialLinks: { linkedin: item.linkedin },
                  })),
          },
        },
        headers: charge(0.00499 * RESULTS),
      };
    case "crustdata.people.search":
      return {
        status: 200,
        body: {
          output: {
            profiles: person.map((item) => ({
              crustdata_person_id: `crust-${item.slug}`,
              basic_profile: {
                name: item.name,
                current_title: item.title,
                location: { raw: `${item.city}, ${item.country}` },
              },
              social_handles: {
                professional_network_identifier: { profile_url: item.linkedin },
              },
              experience: {
                employment_details: { current: [{ name: item.company }] },
              },
            })),
          },
        },
        headers: charge(0.009 * 5),
      };
    case "crustdata.companies.search":
      return {
        status: 200,
        body: {
          output: {
            companies: company.map((item) => ({
              crustdata_company_id: `crust-${item.slug}`,
              basic_info: { name: item.name, primary_domain: item.domain },
              headcount: { total: item.employees },
              locations: { headquarters: `${item.city}, ${item.country}` },
              taxonomy: { professional_network_industry: item.industry },
            })),
          },
        },
        headers: charge(0.009 * 5),
      };
    case "treg.people.search":
      return {
        status: 200,
        body: {
          output: {
            people: person.map((item) => ({
              id: `treg-${item.slug}`,
              full_name: item.name,
              linkedin_url: item.linkedin,
              title: item.title,
              company: item.company,
              location: `${item.city}, ${item.country}`,
            })),
          },
        },
        headers: charge(0.007, "exa"),
      };
    case "treg.companies.search":
      return {
        status: 200,
        body: {
          output: {
            companies: company.map((item) => ({
              id: `treg-${item.slug}`,
              name: item.name,
              domain: item.domain,
              location: `${item.city}, ${item.country}`,
              industry: item.industry,
              employee_count: item.employees,
            })),
          },
        },
        headers: charge(0.007, "exa"),
      };
    default:
      return { status: 404, body: { error: "No synthetic answer." } };
  }
}

const CLAY = "https://api.clay.com/public/v0/search/query-mode";
const DATE = "2026-10-20T00:00:00.000Z";

function answer(request: HttpRequest, accounts: SyntheticAccounts): Answer {
  const { url } = request;
  const key = keyOf(request);
  const body = (request.body ?? {}) as Record<string, unknown>;
  const individual = (value: unknown) =>
    value === "people" || value === "person";
  if (url === "https://openrouter.ai/api/v1/key")
    return {
      status: 200,
      body: {
        data: {
          usage: accounts.openRouterUsage,
          limit: null,
          limit_remaining: null,
        },
      },
    };
  if (url === "https://openrouter.ai/api/v1/credits")
    return {
      status: 200,
      body: {
        data: {
          total_credits: accounts.openRouterCredits,
          total_usage: accounts.openRouterUsage,
        },
      },
    };
  if (url === "https://api.socialapi.me/user")
    return { status: 200, body: { balance: accounts.socialApiCents } };
  if (url === "https://linkdapi.com/api/i/v1/credits/balance/k/")
    return {
      status: 200,
      body: { data: { balance: accounts.renidlyCredits } },
    };
  if (url === "https://treg.to/orgs")
    return { status: 200, body: [{ org_id: "synthetic-org" }] };
  if (url === "https://treg.to/orgs/synthetic-org/balance")
    return { status: 200, body: { balance_usd: accounts.tregBalance } };
  if (url.startsWith("https://treg.to/call/"))
    return treg(
      url.slice("https://treg.to/call/".length),
      request,
      key,
      accounts
    );
  if (url === "https://api.exa.ai/search")
    return {
      status: 200,
      body: {
        results: individual(body.category)
          ? people(key).map((item) => ({
              id: `exa-${item.slug}`,
              url: item.linkedin,
              title: `${item.title} at ${item.company}`,
              text: "Synthetic profile page.",
              publishedDate: DATE,
              entities: [
                {
                  type: "person",
                  properties: {
                    name: item.name,
                    location: `${item.city}, ${item.country}`,
                    workHistory: [
                      {
                        title: item.title,
                        company: { name: item.company },
                        dates: { from: "2020-01-01" },
                      },
                    ],
                  },
                },
              ],
            }))
          : companies(key).map((item) => ({
              id: `exa-${item.slug}`,
              url: `https://${item.domain}`,
              title: item.name,
              text: "Synthetic company page.",
              publishedDate: DATE,
              entities: [
                {
                  type: "company",
                  properties: {
                    name: item.name,
                    headquarters: { city: item.city, country: item.country },
                    workforce: { total: item.employees },
                  },
                },
              ],
            })),
        costDollars: { total: 0.007 },
      },
    };
  if (url === `${CLAY}/reference`)
    return {
      status: 200,
      body: { reference: "Synthetic Clay query reference." },
    };
  if (url === CLAY) {
    const type = String(body.query ?? "").startsWith("people")
      ? "people"
      : "companies";
    return { status: 200, body: { search_id: `synthetic-${type}-${key}` } };
  }
  if (url.startsWith(`${CLAY}/synthetic-`)) {
    const isPeople = url.includes("/synthetic-people-");
    const searchKey = url.split("/").at(-2)!.split("-").slice(2).join("-");
    return {
      status: 200,
      body: isPeople
        ? {
            source_type: "people",
            data: people(searchKey).map((item) => ({
              clay_profile_id: `clay-${item.slug}`,
              name: item.name,
              linkedin_url: item.linkedin,
              location: { name: `${item.city}, ${item.country}` },
              matched_experiences: [
                { is_current: true, title: item.title, company: item.company },
              ],
            })),
          }
        : {
            source_type: "companies",
            data: companies(searchKey).map((item) => ({
              clay_company_id: `clay-${item.slug}`,
              name: item.name,
              linkedin_url: item.linkedin,
              domain: item.domain,
              location: `${item.city}, ${item.country}`,
              industry: item.industry,
              size: item.employees,
            })),
          },
    };
  }
  if (url.startsWith("https://api.context.dev/v1/"))
    return {
      status: 200,
      body: {
        results: url.includes("/people/")
          ? people(key).map((item) => ({
              id: `context-${item.slug}`,
              name: item.name,
              profiles: [item.linkedin],
              role: { title: item.title, company: { name: item.company } },
              location: { city: item.city, country_code: "GB" },
            }))
          : companies(key).map((item) => ({
              id: `context-${item.slug}`,
              name: item.name,
              domain: item.domain,
              socials: { linkedin: item.linkedin },
              headquarters: { city: item.city, country_code: "GB" },
              industries: [item.industry],
              employees: { count: item.employees },
            })),
        key_metadata: { credits_consumed: 43 },
      },
    };
  if (url === "https://api.firecrawl.dev/v2/search")
    return {
      status: 200,
      body: {
        success: true,
        data: {
          web: isCompanyPrompt(key)
            ? companies(key).map((item) => ({
                url: `https://${item.domain}`,
                title: item.name,
                description: "Synthetic search result.",
              }))
            : people(key).map((item) => ({
                url: item.linkedin,
                title: item.name,
                description: "Synthetic search result.",
              })),
        },
        creditsUsed: 2,
      },
    };
  if (url === "https://api.tavily.com/search")
    return {
      status: 200,
      body: {
        results: [1, 2].map((index) => ({
          url: `https://news.example/${hash(String(body.query)).slice(0, 10)}-${index}`,
          title: "Synthetic article",
          content: "Synthetic evidence text for the dry run.",
          published_date: DATE,
        })),
      },
    };
  return { status: 404, body: { error: "No synthetic answer." } };
}

/** Answers every request the benchmark makes, recorded exactly as the live transport records it. */
export function syntheticTransport(accounts: SyntheticAccounts): Transport {
  return async (request) => {
    const result = answer(request, accounts);
    return exchangeSchema.parse({
      step: request.step,
      request: {
        method: request.method,
        url: request.url,
        ...(request.query ? { query: { ...request.query } } : {}),
        ...(request.body === undefined ? {} : { body: request.body }),
        ...(request.headers ? { headers: { ...request.headers } } : {}),
      },
      response: {
        status: result.status,
        body: result.body,
        headers: result.headers ?? {},
      },
      latencyMs: 300 + (number(request.url + request.step) % 700),
    });
  };
}

const HARNESS_COST_USD = 0.0004;
const JUDGE_COST_USD = 0.0003;

/** The harness model: the filter step, Clay's query and Firecrawl's extraction, told apart by their prompts. */
export function syntheticModel(accounts: SyntheticAccounts): StructuredCall {
  return async (model, request) => {
    const input = JSON.parse(request.prompt) as Record<string, unknown>;
    let output: unknown;
    if (Array.isArray(input.criteria) && typeof input.request === "string") {
      const filters: FilterSet = {
        entityType:
          input.entityType === "organization" ? "organization" : "individual",
        keywords: [input.request],
        person: {
          titles: [],
          seniorities: [],
          locations: [],
          minYearsExperience: null,
        },
        company: {
          locations: [],
          industries: [],
          employeeRange: null,
          fundingStages: [],
          technologies: [],
        },
        signals: {
          withinDays: null,
          postedAbout: [],
          mentions: [],
          joinedNewEmployer: false,
          fundingAnnounced: false,
          hiringFor: [],
        },
        coverage: input.criteria.map((criterion: { id: string }) => ({
          criterionId: criterion.id,
          fields: ["keywords"],
        })),
      };
      output = filters;
    } else if (Array.isArray(input.results))
      output = {
        results: input.results.map(
          (item: { result: number; title: string | null }) => ({
            result: item.result,
            name: item.title ?? `Synthetic ${item.result}`,
            title: null,
            employer: null,
            location: null,
            linkedinUrl: null,
            domain: null,
            industry: null,
            description: null,
          })
        ),
      };
    else output = { query: `${String(input.type)}: ${String(input.request)}` };
    accounts.openRouterUsage += HARNESS_COST_USD;
    return {
      output: request.schema.parse(output),
      modelObserved: model,
      costUsd: HARNESS_COST_USD,
      latencyMs: 800,
    };
  };
}

/**
 * Judges that grade from a hash of the result's name and criterion, so most
 * criteria are met, the two primary judges sometimes disagree (calling the
 * tie-breaker) and the same input always gets the same grade.
 */
export function syntheticJudge(accounts: SyntheticAccounts): JudgeCaller {
  return async (model, input) => {
    const criteria = input.criteria.map((criterion) => {
      const base = number(`${input.entity.name}|${criterion.id}`) % 10;
      const flipped =
        number(`${model}|${input.entity.name}|${criterion.id}`) % 12 === 0;
      const score = flipped ? (base + 5) % 10 : base;
      return {
        criterionId: criterion.id,
        verdict: score < 8 ? "met" : score < 9 ? "partly_met" : "not_met",
        evidenceIds: input.entity.evidence.slice(0, 1).map((item) => item.id),
        explanation: "Synthetic grade.",
      };
    });
    accounts.openRouterUsage += JUDGE_COST_USD;
    return {
      output: { caseId: input.caseId, criteria },
      modelObserved: model,
      costUsd: JUDGE_COST_USD,
    };
  };
}
