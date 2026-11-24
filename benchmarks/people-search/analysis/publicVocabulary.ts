import type { PublicVocabulary } from "../../core/analysis/publish";
import { taskId } from "../setup/criteria";
import { peopleSearchPlan } from "../setup/plan";
import { peopleSearchRates } from "../setup/rates";
import { SEGMENTS } from "../setup/schedule";
import { toolCatalog } from "../tools/catalog";

// Providers and units the adapters and the ReacherX cost summary report,
// beyond those in the frozen rate snapshot. Code names, never people.
const PROVIDERS = [
  "openrouter",
  "openrouter-harness",
  "socialapi",
  "renidly",
  "exa",
  "treg",
  "apollo",
  "lusha",
  "crustdata",
  "clay",
  "context.dev",
  "firecrawl",
  "tavily",
];
const UNITS = [
  "usd",
  "credit",
  "credits",
  "request",
  "request-without-credit-report",
  "call",
  "result",
  "search",
  "model-call",
];

/**
 * The only values the people-search public results may contain: the plan's
 * prompts, category keys and labels, tool IDs, known provider and unit names,
 * and run IDs of the form `ps-<plan digest prefix>-<segment>`.
 */
export function peopleSearchPublicVocabulary(): PublicVocabulary {
  const rates = peopleSearchRates("2026-01-01T00:00:00Z");
  return {
    runId: new RegExp(`^ps-[0-9a-f]{12}-(?:${SEGMENTS.join("|")})$`),
    taskIds: peopleSearchPlan.prompts.map((prompt) => taskId(prompt.id)),
    categories: Object.entries(peopleSearchPlan.categories).flatMap(
      ([key, category]) => [key, category.label]
    ),
    toolIds: toolCatalog.map((tool) => tool.id),
    providers: [
      ...new Set([
        ...PROVIDERS,
        ...rates.rates.map((rate) => rate.provider),
        ...rates.funding.map((item) => item.provider),
      ]),
    ],
    units: [...new Set([...UNITS, ...rates.rates.map((rate) => rate.unit)])],
  };
}
