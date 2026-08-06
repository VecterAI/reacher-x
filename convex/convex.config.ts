// convex/convex.config.ts
import { v } from "convex/values";
import { defineApp } from "convex/server";
import workflow from "@convex-dev/workflow/convex.config";
import agent from "@convex-dev/agent/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import rag from "@convex-dev/rag/convex.config";
import polar from "@convex-dev/polar/convex.config";
import migrations from "@convex-dev/migrations/convex.config";

const app = defineApp({
  env: {
    AI_FAST_MODEL: v.optional(v.string()),
    AI_REASONING_MODEL: v.optional(v.string()),
    AI_AUTOCOMPLETE_MODEL: v.optional(v.string()),
    INLINE_AUTOCOMPLETE_ENABLED: v.optional(v.string()),
    AI_SETUP_AGENT_MODEL: v.optional(v.string()),
    AI_MAIN_AGENT_MODEL: v.optional(v.string()),
    AI_OUTREACH_ROUTER_MODEL: v.optional(v.string()),
    AI_OUTREACH_FAST_MODEL: v.optional(v.string()),
    AI_OUTREACH_STANDARD_MODEL: v.optional(v.string()),
    AI_OUTREACH_RECOVERY_MODEL: v.optional(v.string()),
    AI_VISION_MODEL: v.optional(v.string()),
    AI_TEXT_EMBEDDING_MODEL: v.optional(v.string()),
    OPENROUTER_ROUTING_PRESET: v.optional(
      v.union(v.literal("current"), v.literal("cost_optimized"))
    ),
    PROSPECTING_AUTO_RESCHEDULE: v.optional(v.string()),
    PROSPECTING_RESCHEDULE_INTERVAL_MINUTES: v.optional(v.string()),
    PROSPECTING_BOOTSTRAP_READY_TARGET: v.optional(v.string()),
    PROSPECTING_BOOTSTRAP_INTERVAL_MINUTES: v.optional(v.string()),
    PROSPECTING_BOOTSTRAP_MAX_CYCLES: v.optional(v.string()),
    PROSPECTING_BOOTSTRAP_NO_PROGRESS_TIMEOUT_MINUTES: v.optional(v.string()),
    PROSPECTING_BOOTSTRAP_PENDING_QUALIFICATION_YIELD_PERCENT: v.optional(
      v.string()
    ),
    PROSPECTING_SEED_KEYWORDS_PER_CYCLE: v.optional(v.string()),
    PROSPECTING_SOCIAL_QUERIES_PER_CYCLE: v.optional(v.string()),
    PROSPECTING_TWITTER_SEARCH_BATCH: v.optional(v.string()),
    PROSPECTING_LINKEDIN_POST_SEARCH_BATCH: v.optional(v.string()),
    PROSPECTING_LINKEDIN_PEOPLE_SEARCH_BATCH: v.optional(v.string()),
    PROSPECTING_RECOVERY_BASE_DELAY_MINUTES: v.optional(v.string()),
    PROSPECTING_RECOVERY_MAX_DELAY_MINUTES: v.optional(v.string()),
    PROSPECTING_RECOVERY_JITTER_MINUTES: v.optional(v.string()),
    PROSPECTING_AI_RETRY_MAX_ATTEMPTS: v.optional(v.string()),
    PROSPECTING_AI_RETRY_INITIAL_BACKOFF_MS: v.optional(v.string()),
    PROSPECTING_PROVIDER_RETRY_MAX_ATTEMPTS: v.optional(v.string()),
    PROSPECTING_PROVIDER_RETRY_INITIAL_BACKOFF_MS: v.optional(v.string()),
    PROSPECTING_AUXILIARY_RETRY_MAX_ATTEMPTS: v.optional(v.string()),
    PROSPECTING_AUXILIARY_RETRY_INITIAL_BACKOFF_MS: v.optional(v.string()),
    PROSPECTING_RETRY_BACKOFF_BASE: v.optional(v.string()),
    SOCIALAPI_REQUESTS_PER_MINUTE: v.optional(v.string()),
    SOCIALAPI_TARGET_REQUESTS_PER_MINUTE: v.optional(v.string()),
    SOCIALAPI_BUDGET_RESERVATION_MAX_ATTEMPTS: v.optional(v.string()),
    SOCIALAPI_OCC_RETRY_BASE_MS: v.optional(v.string()),
    SOCIALAPI_OCC_RETRY_JITTER_MS: v.optional(v.string()),
    LINKDAPI_REQUESTS_PER_MINUTE: v.optional(v.string()),
    LINKDAPI_TARGET_REQUESTS_PER_MINUTE: v.optional(v.string()),
    LINKDAPI_BUDGET_RESERVATION_MAX_ATTEMPTS: v.optional(v.string()),
    LINKDAPI_OCC_RETRY_BASE_MS: v.optional(v.string()),
    LINKDAPI_OCC_RETRY_JITTER_MS: v.optional(v.string()),
    QUALIFICATION_MAX_PARALLELISM: v.optional(v.string()),
    QUALIFICATION_RETRY_MAX_ATTEMPTS: v.optional(v.string()),
    QUALIFICATION_RETRY_INITIAL_BACKOFF_MS: v.optional(v.string()),
    ENRICHMENT_MAX_PARALLELISM: v.optional(v.string()),
    ENRICHMENT_RETRY_MAX_ATTEMPTS: v.optional(v.string()),
    ENRICHMENT_RETRY_INITIAL_BACKOFF_MS: v.optional(v.string()),
    OUTREACH_PLAN_MAX_PARALLELISM: v.optional(v.string()),
    OUTREACH_PLAN_RETRY_MAX_ATTEMPTS: v.optional(v.string()),
    OUTREACH_PLAN_RETRY_INITIAL_BACKOFF_MS: v.optional(v.string()),
    WORKPOOL_RETRY_BACKOFF_BASE: v.optional(v.string()),
    PROVIDER_CIRCUIT_PROBE_INTERVAL_SECONDS: v.optional(v.string()),
    PROVIDER_CIRCUIT_PROBE_LEASE_SECONDS: v.optional(v.string()),
    PROVIDER_TRANSIENT_FAILURES_BEFORE_OPEN: v.optional(v.string()),
    PROVIDER_RATE_LIMIT_RETRY_SECONDS: v.optional(v.string()),
    PROVIDER_TRANSIENT_RETRY_SECONDS: v.optional(v.string()),
  },
});

// Register Convex components
app.use(workflow);
app.use(agent);
app.use(actionRetrier);
app.use(migrations);
// Workpools for throttling (prevents OCC errors on rate limit table)
app.use(workpool, { name: "qualificationPool" });
app.use(workpool, { name: "enrichmentPool" });
app.use(workpool, { name: "previewQualificationPool" });
app.use(workpool, { name: "previewEnrichmentPool" });
app.use(workpool, { name: "outreachPlanPool" });
app.use(workpool, { name: "memoryEvaluationPool" });
// RAG for semantic search in outreach
app.use(rag);
// Polar for subscription payments
app.use(polar);

export default app;
