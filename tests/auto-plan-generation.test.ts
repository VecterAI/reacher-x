import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { zodSchema } from "ai";
import {
  AUTO_PLAN_MAX_RUNS_PER_RECOVERY_WINDOW,
  AUTO_PLAN_RECOVERY_WINDOW_MS,
  assessAutoPlanGrounding,
  autoPlanDraftSchema,
  autoPlanTransportSchema,
  classifyAutoPlanFailure,
  hasAutoPlanRecoveryCapacity,
  isAutoPlanFailureRecoveryEligible,
  parseAutoPlanTransportDraft,
  validateAutoPlanDraftAgainstGrounding,
  type AutoPlanDraft,
  type AutoPlanGroundingContext,
} from "../convex/lib/autoPlanCore";

const ROOT = process.cwd();

function asSchemaObject(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  assert.ok(
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
  return value;
}

function createGroundingContext(
  overrides: Partial<AutoPlanGroundingContext> = {}
): AutoPlanGroundingContext {
  return {
    generatedAt: 1,
    workspace: {
      name: "Workspace",
      description: "We help developer-tool teams improve onboarding.",
      useCaseKey: "sales",
      icps: [
        {
          title: "Developer-tool founder",
          description: "Early-stage founder improving activation.",
          painPoints: ["Low activation"],
          channels: ["twitter"],
        },
      ],
      connectedAccounts: {
        x: { username: "owner", status: "connected", subscriptionType: null },
        linkedin: null,
      },
      agentSettings: { autonomyMode: "supervised" },
    },
    prospectProfileContext: "Founder of a developer tool with onboarding work.",
    storedSignalCount: 2,
    writingStyle: "Direct, concise, and practical.",
    freshPlatformProfile: { name: "Prospect" },
    recentPosts: [
      {
        id: "fresh-post-1",
        platform: "twitter",
        createdAt: 1,
        textPreview: "We are improving onboarding this month.",
      },
    ],
    websiteResearch: [],
    webResearch: [
      {
        query: "Prospect onboarding",
        findings: [
          {
            title: "Product update",
            url: "https://example.com/update",
            snippet: "The team launched a new onboarding flow.",
          },
        ],
      },
    ],
    retrievalErrors: [],
    linkedinRelationship: null,
    ...overrides,
  };
}

function createValidDraft(): AutoPlanDraft {
  return {
    strategy: {
      rationale: "Their current onboarding initiative matches the offering.",
      targetTweetId: "fresh-post-1",
      valueProposition: "Share a practical activation improvement.",
      tone: "Direct and useful",
    },
    tasks: [
      {
        type: "comment",
        description: "Add a useful observation to the onboarding post.",
        timing: { type: "immediate" },
        targetTweetId: "fresh-post-1",
        content:
          "The shorter first-run path is a strong move—especially the early win.",
      },
    ],
  };
}

test("automatic plan eligibility starts at score 80", () => {
  const source = readFileSync(`${ROOT}/convex/lib/outreachCore.ts`, "utf8");
  assert.match(source, /AUTO_PLAN_GENERATION_THRESHOLD = 80/);
});

test("grounding requires workspace, ICP, stored signals, style, fresh profile, and research", () => {
  assert.deepEqual(assessAutoPlanGrounding(createGroundingContext()), {
    ready: true,
  });

  const incomplete = createGroundingContext({
    workspace: {
      ...createGroundingContext().workspace,
      description: "",
      icps: [],
    },
    storedSignalCount: 0,
    writingStyle: "",
    freshPlatformProfile: null,
    websiteResearch: [],
    webResearch: [],
  });
  const assessment = assessAutoPlanGrounding(incomplete);
  assert.equal(assessment.ready, false);
  if (!assessment.ready) {
    assert.equal(assessment.reasons.length, 6);
  }
});

test("plan validation rejects invented post IDs and empty outreach", () => {
  const hallucinated = createValidDraft();
  hallucinated.tasks[0].targetTweetId = "invented-post";
  assert.match(
    validateAutoPlanDraftAgainstGrounding({
      draft: hallucinated,
      recentPosts: createGroundingContext().recentPosts,
    }).join(" "),
    /not freshly retrieved/
  );

  const noOutreach = createValidDraft();
  noOutreach.strategy.targetTweetId = undefined;
  noOutreach.tasks = [
    {
      type: "wait",
      description: "Wait for a relevant post.",
      timing: { type: "event", value: "next_post" },
    },
  ];
  assert.match(
    validateAutoPlanDraftAgainstGrounding({
      draft: noOutreach,
      recentPosts: [],
    }).join(" "),
    /at least one comment, DM, or reaction task/
  );
});

test("workpool completion verifies persistence before completed status", () => {
  const workflowSource = readFileSync(
    `${ROOT}/convex/workflows/autoPlan.ts`,
    "utf8"
  );
  const completionIndex = workflowSource.indexOf('status: "completed"');
  assert.match(workflowSource, /persistedPlan\.tasks\.length > 0/);
  assert.ok(
    workflowSource.indexOf("persistedPlan.tasks.length") < completionIndex
  );
  assert.match(workflowSource, /handleAutoPlanWorkComplete/);
  assert.match(workflowSource, /upsertNotificationByKey/);

  const actionSource = readFileSync(
    `${ROOT}/convex/outreachActions.ts`,
    "utf8"
  );
  assert.match(actionSource, /getOutreachPlanPool\(\)\.enqueueAction/);
  assert.match(actionSource, /retry: true/);

  const enrichmentSource = readFileSync(
    `${ROOT}/convex/workflows/enrichment.ts`,
    "utf8"
  );
  assert.doesNotMatch(enrichmentSource, /status: "generating"/);
});

test("automatic generation caches successful grounding stages and isolates agent history", () => {
  const actionSource = readFileSync(
    `${ROOT}/convex/autoPlanActions.ts`,
    "utf8"
  );
  assert.match(actionSource, /mode: "platform_profile"/);
  assert.match(actionSource, /mode: "posts"/);
  assert.match(actionSource, /readWebPages/);
  assert.match(actionSource, /runDeepResearch/);
  assert.match(actionSource, /assessAutoPlanGrounding/);
  assert.match(actionSource, /generateObject/);
  assert.match(actionSource, /saveMessages: "none"/);
  assert.match(actionSource, /saveAutoPlanGroundingStageInternal/);
  assert.match(actionSource, /recentMessages: 0/);
  assert.match(actionSource, /textSearch: false/);
  assert.match(actionSource, /vectorSearch: false/);
  assert.match(actionSource, /schema: autoPlanTransportSchema/);

  const strictValidationIndex = actionSource.indexOf(
    "autoPlanDraftSchema.parse(generated.object)"
  );
  const planCreationIndex = actionSource.lastIndexOf(
    "internal.outreach.createPlan"
  );
  const visibleThreadIndex = actionSource.lastIndexOf(
    "ensureVisibleAutoPlanThread"
  );
  assert.ok(strictValidationIndex < planCreationIndex);
  assert.ok(planCreationIndex < visibleThreadIndex);
});

test("provider transport schema stays compatible while app validation remains strict", () => {
  const transportDraft = {
    strategy: {
      rationale: "Wait for a relevant signal before reaching out.",
      targetTweetId: null,
      valueProposition: "Share a relevant onboarding improvement.",
      tone: "Direct and useful",
    },
    tasks: [
      {
        type: "wait" as const,
        description: "Wait for a relevant post.",
        timing: { type: "event" as const, value: null },
        targetTweetId: null,
        targetCommentId: null,
        reactionType: null,
        content: null,
      },
    ],
  };

  assert.equal(autoPlanTransportSchema.safeParse(transportDraft).success, true);
  assert.equal(autoPlanDraftSchema.safeParse(transportDraft).success, false);
  assert.deepEqual(parseAutoPlanTransportDraft(transportDraft), {
    strategy: {
      rationale: "Wait for a relevant signal before reaching out.",
      targetTweetId: undefined,
      valueProposition: "Share a relevant onboarding improvement.",
      tone: "Direct and useful",
    },
    tasks: [
      {
        type: "wait",
        description: "Wait for a relevant post.",
        timing: { type: "event", value: undefined },
        targetTweetId: undefined,
        targetCommentId: undefined,
        reactionType: undefined,
        content: undefined,
      },
    ],
  });
});

test("provider transport JSON schema requires every nullable field", async () => {
  const schema = asSchemaObject(
    await zodSchema(autoPlanTransportSchema).jsonSchema
  );
  const properties = asSchemaObject(schema.properties);
  const strategy = asSchemaObject(properties.strategy);
  const tasks = asSchemaObject(properties.tasks);

  assert.deepEqual(asStringArray(strategy.required), [
    "rationale",
    "targetTweetId",
    "valueProposition",
    "tone",
  ]);
  const task = asSchemaObject(tasks.items);
  assert.deepEqual(asStringArray(task.required), [
    "type",
    "description",
    "timing",
    "targetTweetId",
    "targetCommentId",
    "reactionType",
    "content",
  ]);
  const taskProperties = asSchemaObject(task.properties);
  const timing = asSchemaObject(taskProperties.timing);
  assert.deepEqual(asStringArray(timing.required), ["type", "value"]);
});

test("automatic plan failures distinguish terminal setup issues from transient providers", () => {
  assert.deepEqual(
    classifyAutoPlanFailure("Workspace writing style is not ready"),
    {
      code: "writing_style_unavailable",
      retryable: false,
      userMessage:
        "Writing style is unavailable. Refresh it from Connected accounts.",
      actionLabel: "Reconnect",
      targetHref: "/settings/connected-accounts",
    }
  );
  assert.equal(
    classifyAutoPlanFailure("Provider returned 503").retryable,
    true
  );
  assert.equal(
    classifyAutoPlanFailure("Unsupported minLength").retryable,
    false
  );
  assert.deepEqual(
    classifyAutoPlanFailure(
      "Invalid schema for response_format 'response': required is required to be supplied"
    ),
    {
      code: "provider_schema_unsupported",
      retryable: false,
      userMessage:
        "The plan generator returned an unsupported format. Try again after the issue is resolved.",
    }
  );
  assert.deepEqual(classifyAutoPlanFailure("SocialAPI: Insufficient balance"), {
    code: "provider_balance_unavailable",
    retryable: false,
    userMessage: "We’ll try again automatically.",
  });
  assert.equal(
    isAutoPlanFailureRecoveryEligible("provider_balance_unavailable"),
    true
  );
  assert.equal(
    isAutoPlanFailureRecoveryEligible("grounding_unavailable"),
    true
  );
  assert.equal(
    isAutoPlanFailureRecoveryEligible("provider_schema_unsupported"),
    false
  );
  assert.equal(isAutoPlanFailureRecoveryEligible("context_too_large"), false);
  assert.equal(isAutoPlanFailureRecoveryEligible("reconnect_required"), false);
  assert.equal(
    isAutoPlanFailureRecoveryEligible("writing_style_unavailable"),
    false
  );
});

test("automatic plan recovery is bounded within a rolling window", () => {
  const now = AUTO_PLAN_RECOVERY_WINDOW_MS * 2;
  assert.equal(
    hasAutoPlanRecoveryCapacity(
      Array.from(
        { length: AUTO_PLAN_MAX_RUNS_PER_RECOVERY_WINDOW - 1 },
        (_, index) => now - index * 1_000
      ),
      now
    ),
    true
  );
  assert.equal(
    hasAutoPlanRecoveryCapacity(
      Array.from(
        { length: AUTO_PLAN_MAX_RUNS_PER_RECOVERY_WINDOW },
        (_, index) => now - index * 1_000
      ),
      now
    ),
    false
  );
  assert.equal(
    hasAutoPlanRecoveryCapacity(
      [
        now,
        now - AUTO_PLAN_RECOVERY_WINDOW_MS - 1,
        now - AUTO_PLAN_RECOVERY_WINDOW_MS - 2,
      ],
      now
    ),
    true
  );
});

test("automatic plan reliability prevents repeated paid work and dead notification actions", () => {
  const actionSource = readFileSync(
    `${ROOT}/convex/autoPlanActions.ts`,
    "utf8"
  );
  assert.ok(
    actionSource.indexOf('mode: "platform_profile"') <
      actionSource.indexOf("readWebPages(")
  );
  assert.ok(
    actionSource.indexOf('mode: "posts"') <
      actionSource.lastIndexOf("runDeepResearch(")
  );

  const workflowSource = readFileSync(
    `${ROOT}/convex/workflows/autoPlan.ts`,
    "utf8"
  );
  assert.match(workflowSource, /buildAutoPlanFailureNotificationTitle/);
  assert.doesNotMatch(workflowSource, /externalId/);
  assert.doesNotMatch(workflowSource, /View details/);

  const monitorSource = readFileSync(
    `${ROOT}/convex/socialapiMonitors.ts`,
    "utf8"
  );
  assert.match(monitorSource, /withIndex\("by_workspace_value"/);
  assert.match(monitorSource, /normalizeMemoryText\(args\.query\)/);
  assert.doesNotMatch(
    monitorSource,
    /for \(const query of keywords\.socialQueries\)/
  );

  const prospectSource = readFileSync(`${ROOT}/convex/prospects.ts`, "utf8");
  assert.match(prospectSource, /prospect\.planGenerationStatus !== "idle"/);

  const runSource = readFileSync(`${ROOT}/convex/autoPlanRuns.ts`, "utf8");
  assert.match(runSource, /recoveryExhaustedAt/);
  assert.match(runSource, /Automatic retries stopped after repeated failures/);
  assert.match(runSource, /buildAutoPlanFailureNotificationTitle/);
  assert.doesNotMatch(runSource, /externalId/);
});

test("keyed failure notifications resurface as new events", () => {
  const notificationSource = readFileSync(
    `${ROOT}/convex/lib/notificationHelpers.ts`,
    "utf8"
  );
  const outreachSource = readFileSync(`${ROOT}/convex/outreach.ts`, "utf8");
  const toastSource = readFileSync(
    `${ROOT}/shared/hooks/useOutreachNotificationToast.ts`,
    "utf8"
  );

  assert.match(notificationSource, /eventVersion: 1/);
  assert.match(notificationSource, /eventUpdatedAt: now/);
  assert.match(notificationSource, /existing\.eventVersion \?\? 0/);
  assert.match(outreachSource, /by_user_workspace_event_updated_at/);
  assert.match(outreachSource, /\.order\("desc"\)/);
  assert.match(toastSource, /getOutreachNotificationEventKey/);

  const inboxSource = readFileSync(
    `${ROOT}/features/webapp/ui/components/notifications/NotificationsInbox.tsx`,
    "utf8"
  );
  assert.match(inboxSource, /getOutreachNotificationEventTimestamp/);
});

test("auto-plan history hides legacy blank threads", () => {
  const chatSource = readFileSync(`${ROOT}/convex/chat.ts`, "utf8");
  assert.match(chatSource, /isAutoPlanHistoryRow/);
  assert.match(chatSource, /hasVisibleMessagesByThreadId/);
  assert.match(chatSource, /role === "user" \|\| role === "assistant"/);
});
