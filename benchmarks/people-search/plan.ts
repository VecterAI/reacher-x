import { toolCatalog } from "./tools/catalog";
import type { RunManifest } from "../core/manifest";

const categories = {
  "people-static": {
    entityType: "individual",
    label: "People, static filters",
  },
  "people-signals": { entityType: "individual", label: "People, signals" },
  "company-static": {
    entityType: "organization",
    label: "Companies, static filters",
  },
  "company-signals": {
    entityType: "organization",
    label: "Companies, signals",
  },
} as const;

type Prompt = {
  id: number;
  category: keyof typeof categories;
  text: string;
};

// Approved wording and stable IDs. Criteria and reference dates are frozen separately before live runs.
const prompts = [
  {
    id: 1,
    category: "people-static",
    text: "Find software engineers based in London with 5+ years of experience.",
  },
  {
    id: 2,
    category: "people-static",
    text: "I'm hiring a senior backend engineer in Amsterdam. Find people I could reach out to.",
  },
  {
    id: 3,
    category: "people-static",
    text: "Find product managers working at health-tech startups in the United Kingdom.",
  },
  {
    id: 4,
    category: "people-static",
    text: "Find data scientists working in banking or finance in New York City.",
  },
  {
    id: 5,
    category: "people-static",
    text: "Find marketing leaders at B2B SaaS companies in the US with 50-500 employees.",
  },
  {
    id: 6,
    category: "people-signals",
    text: "Find developers in Germany who have posted about React in the last 90 days.",
  },
  {
    id: 7,
    category: "people-signals",
    text: "Find software engineers in the US who joined a new employer in the last 90 days.",
  },
  {
    id: 8,
    category: "people-signals",
    text: "Find founders in India whose companies announced a funding round in the last 6 months.",
  },
  {
    id: 9,
    category: "people-static",
    text: "Find CEOs of software companies headquartered in the United Kingdom.",
  },
  {
    id: 10,
    category: "people-static",
    text: "Find heads of product at fintech companies headquartered in the US.",
  },
  {
    id: 11,
    category: "people-signals",
    text: "Find indie developers who build with Next.js.",
  },
  {
    id: 12,
    category: "people-signals",
    text: "Find marketers who mention using HubSpot.",
  },
  {
    id: 13,
    category: "company-signals",
    text: "Looking for: European fintech companies, Series A stage, funding announced in the last 12 months.",
  },
  {
    id: 14,
    category: "company-static",
    text: "Find early-stage AI startups in North America.",
  },
  {
    id: 15,
    category: "company-static",
    text: "Find healthcare companies in the United States with 200-1,000 employees.",
  },
  {
    id: 16,
    category: "company-static",
    text: "Find marketing agencies in Brazil that offer SEO services.",
  },
  {
    id: 17,
    category: "company-static",
    text: "Find B2B SaaS companies in Europe with 50-200 employees.",
  },
  {
    id: 18,
    category: "company-signals",
    text: "Find tech companies in the US with 100-1,000 employees that are currently hiring backend engineers.",
  },
  {
    id: 19,
    category: "company-signals",
    text: "Find climate-tech companies in Europe currently hiring data scientists.",
  },
  {
    id: 20,
    category: "company-static",
    text: "Find e-commerce brands headquartered in the United Kingdom.",
  },
] as const satisfies readonly Prompt[];

export const peopleSearchPlan = {
  id: "people-search-v2",
  sourceProposal: {
    path: "docs/benchmark/people-search-v2-proposal.pdf",
    sha256: "af98cb73be6acd87736ea2fd40869677ef6ae5d693393c8e53c1617f006be2b6",
    revision: "v30",
  },
  status: "setup-only",
  criteriaFrozen: false,
  referenceDate: null,
  categories,
  prompts,
  tools: toolCatalog,
  headlineTopK: 5,
  qualificationThreshold: 70,
  execution: {
    maxConcurrentWorkspaces: 1,
    initialCycleGapMinutes: 10,
    waitForQualificationAndLessons: true,
    learningOff: {
      disable: [
        "learned-lessons",
        "similar-past-cases",
        "query-performance-ranking",
      ],
      preserve: [
        "scheduled-broadening",
        "newer-post-fetching",
        "skip-seen-entities",
      ],
    },
  },
  artifacts: {
    private: "benchmarks/.local/people-search",
    public: "benchmarks/people-search/results",
  },
  models: {
    planningAndQualification: "openai/gpt-6-luna-pro",
    enrichment: "openai/gpt-oss-120b",
    embeddings: "openai/text-embedding-3-small",
    judges: ["z-ai/glm-5.3-flash", "deepseek/deepseek-v4.1-flash"],
    tieBreaker: "qwen/qwen3.8-flash",
  },
  // Cycle allowances from the proposal, not instructions to start jobs.
  stage1: {
    companySmokeCycles: 1,
    pilotPeoplePrompts: 2,
    cyclesPerPilotWorkspace: 4,
    learningConditions: ["on", "off"],
    remainingFirstCycles: 17,
  },
  stage2: {
    peoplePrompts: { min: 7, max: 10 },
    cyclesPerWorkspace: { min: 5, max: 8 },
    learningConditions: ["on", "off"],
    useFreshWorkspaces: true,
  },
} as const;

/** The local execution engine is reusable; this CLI remains bound to the approved people-search plan. */
export function assertPeopleSearchManifest(manifest: RunManifest) {
  if (
    manifest.planId !== peopleSearchPlan.id ||
    manifest.sourceProposal.path !== peopleSearchPlan.sourceProposal.path ||
    manifest.sourceProposal.sha256 !== peopleSearchPlan.sourceProposal.sha256 ||
    manifest.tasks.length !== prompts.length
  ) {
    throw new Error(
      "The frozen manifest must reference the approved people-search proposal and all 20 prompts."
    );
  }
  for (const task of manifest.tasks) {
    const approved = prompts.find((prompt) => String(prompt.id) === task.id);
    if (
      !approved ||
      task.prompt !== approved.text ||
      task.entityType !== categories[approved.category].entityType
    )
      throw new Error(
        "A task differs from the approved prompt or entity type."
      );
  }
}
