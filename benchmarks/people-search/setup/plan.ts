import { toolCatalog } from "../tools/catalog";
import type { RunManifest } from "../../core/setup/manifest";
import type { RunSettings } from "../../core/execution/liveSession";
import { seededRandom, shuffled } from "../../core/random";

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

// Proposal 5.5. Production values were read from the production deployment by
// the project lead on 15 Nov 2026 and are set explicitly for every live step.
// Worker parallelism is left out on purpose: it is tuned to Starter limits in
// the smoke test, identically for both learning groups.
const runSettings = {
  production: {
    PROSPECTING_BOOTSTRAP_READY_TARGET: "12",
    PROSPECTING_BOOTSTRAP_MAX_CYCLES: "8",
    PROSPECTING_BOOTSTRAP_NO_PROGRESS_TIMEOUT_MINUTES: "20",
    PROSPECTING_BOOTSTRAP_PENDING_QUALIFICATION_YIELD_PERCENT: "30",
    PROSPECTING_SEED_KEYWORDS_PER_CYCLE: "10",
    PROSPECTING_SOCIAL_QUERIES_PER_CYCLE: "15",
    PROSPECTING_TWITTER_SEARCH_BATCH: "9",
    PROSPECTING_TWITTER_SEARCH_PAGES_PER_QUERY: "3",
    PROSPECTING_TWITTER_SEARCH_LOOKBACK_DAYS: "90",
    PROSPECTING_LINKEDIN_POST_SEARCH_BATCH: "5",
    PROSPECTING_LINKEDIN_PEOPLE_SEARCH_BATCH: "4",
    PROVIDER_SEARCH_MAX_RUNTIME_MS: "30000",
    AI_ONBOARDING_MODEL: "openai/gpt-6-luna-pro",
    AI_REASONING_MODEL: "openai/gpt-oss-120b",
    AI_FAST_MODEL: "openai/gpt-oss-120b",
    AI_TEXT_EMBEDDING_MODEL: "openai/text-embedding-3-small",
    OPENROUTER_ROUTING_PRESET: "cost_optimized",
  },
  productionSource:
    "Production deployment env, read by the project lead on 2026-11-15",
  // Production waits 2 minutes between bootstrap cycles, then 60 once 12
  // people are ready or 8 cycles have run. Both gaps are 10 minutes in a run,
  // so every cycle has time for qualification and lessons (the project lead
  // agreed the hourly gap need not be kept).
  runOnly: {
    PROSPECTING_BOOTSTRAP_INTERVAL_MINUTES: "10",
    PROSPECTING_RESCHEDULE_INTERVAL_MINUTES: "10",
  },
  // A D1 decision; null keeps the deployment's pool defaults.
  poolLimits: null,
} as const satisfies RunSettings;

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
    // Production's first-hour bootstrap gap is 2 minutes (PROSPECTING_BOOTSTRAP_INTERVAL_MINUTES).
    initialCycleGapMinutes: 10,
    runSettings,
    statusPollSeconds: 30,
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
  // Proposal 3.3 and 5.7.
  judging: {
    evidenceSearchesPerResult: 2,
    rejectedSamplePerPromptCycle: 3,
    minHumanAgreementKappa: 0.7,
    pilotHumanLabels: 40,
    mainHumanLabels: 60,
  },
  // Proposal 6.4: conditions checked before asking to continue.
  decisionPoints: {
    D1: { maxCycleCostUsd: 0.65 },
    D2: { minHumanAgreementKappa: 0.7 },
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

// Proposal 3.3: judges never come from OpenAI, whose models ReacherX uses.
type JudgeModel =
  | (typeof peopleSearchPlan.models.judges)[number]
  | typeof peopleSearchPlan.models.tieBreaker;
/** `never` when any one of the listed models is an OpenAI model. */
export type NoOpenAIModel<Model extends string> = [
  Extract<Model, `openai/${string}`>,
] extends [never]
  ? true
  : never;
export const judgesAreIndependent: NoOpenAIModel<JudgeModel> = true;

/** Proposal 3.2: a prompt's two runs go back to back, and the order alternates between prompts. */
export function learningOrder(position: number) {
  if (!Number.isInteger(position) || position < 0)
    throw new Error("Positions start at 0.");
  return position % 2 === 0
    ? (["on", "off"] as const)
    : (["off", "on"] as const);
}

/**
 * Proposal 6.3: the people static prompts added to stage 2, drawn with the
 * frozen seed before any results are seen. The count (2 to 5) is set at D3.
 */
export function drawStage2StaticPrompts(seed: number, count: number) {
  if (!Number.isInteger(count) || count < 2 || count > 5)
    throw new Error("Stage 2 adds 2 to 5 people static prompts.");
  const staticIds: number[] = prompts
    .filter((prompt) => prompt.category === "people-static")
    .map((prompt) => prompt.id);
  return shuffled(staticIds, seededRandom(seed))
    .slice(0, count)
    .sort((a, b) => a - b);
}

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
