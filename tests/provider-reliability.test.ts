import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  classifyProviderFailure,
  estimateSocialApiBillableUnits,
  EXA_CONTENT_COST_PER_PAGE_USD,
  EXA_SEARCH_COST_PER_REQUEST_USD,
  hasProviderHealthEvidence,
  isProviderHealthEvidenceHttpStatus,
  SOCIAL_API_COST_PER_ENTITY_USD,
} from "../convex/lib/providerReliability";
import { fetchSocialApi } from "../convex/lib/socialApiFetch";
import { isAutoPlanGroundingStageFresh } from "../convex/lib/autoPlanGroundingCacheCore";
import { normalizeNotificationCopy } from "../features/webapp/lib/notificationCopy";
import { getWorkspaceSystemStatusDotClassName } from "../features/webapp/lib/workspaceSystemStatusTone";
import {
  getOutreachNotificationEventKey,
  getOutreachNotificationEventTimestamp,
} from "../shared/lib/notifications/outreachNotificationEvents";

const ROOT = process.cwd();

test("credit and rate-limit failures open the correct provider circuit", () => {
  assert.equal(
    classifyProviderFailure("NO_MORE_CREDITS: payment required").reason,
    "credits"
  );
  assert.equal(
    classifyProviderFailure("429 rate limit exceeded").reason,
    "rate_limit"
  );
  assert.equal(
    classifyProviderFailure("503 temporarily unavailable").reason,
    "transient"
  );
  assert.equal(classifyProviderFailure("unknown", 402).reason, "credits");
  assert.equal(
    classifyProviderFailure("unknown", 401).reason,
    "authentication"
  );
  assert.equal(classifyProviderFailure("unknown", 429).reason, "rate_limit");
  assert.equal(classifyProviderFailure("unknown", 500).reason, "transient");
});

test("expected provider 4xx responses prove health without opening the circuit", () => {
  assert.equal(isProviderHealthEvidenceHttpStatus(404), true);
  assert.equal(isProviderHealthEvidenceHttpStatus(422), true);
  assert.equal(isProviderHealthEvidenceHttpStatus(401), false);
  assert.equal(isProviderHealthEvidenceHttpStatus(402), false);
  assert.equal(isProviderHealthEvidenceHttpStatus(403), false);
  assert.equal(isProviderHealthEvidenceHttpStatus(408), false);
  assert.equal(isProviderHealthEvidenceHttpStatus(429), false);
  assert.equal(isProviderHealthEvidenceHttpStatus(500), false);
  assert.equal(isProviderHealthEvidenceHttpStatus(undefined), false);

  assert.equal(hasProviderHealthEvidence("error", true), true);
  assert.equal(hasProviderHealthEvidence("error", false), false);
  assert.equal(hasProviderHealthEvidence("success", undefined), true);
  assert.equal(hasProviderHealthEvidence("success", false), false);
});

test("SocialAPI 404 responses preserve status and cannot poison the circuit", async () => {
  const originalFetch = globalThis.fetch;
  const mutationArgs: unknown[] = [];
  let mutationCallCount = 0;
  const ctx = {
    runMutation: async (_reference: unknown, args: unknown) => {
      mutationArgs.push(args);
      mutationCallCount += 1;
      return mutationCallCount === 1
        ? { allowed: true, reason: undefined, retryAfterAt: undefined }
        : null;
    },
    runAction: async () => ({
      waitMs: 0,
      spacingMs: 200,
      targetRequestsPerMinute: 300,
    }),
  } as unknown as Parameters<typeof fetchSocialApi>[0];

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ status: "error", message: "User not found" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );

  try {
    const response = await fetchSocialApi(
      ctx,
      "test.missingProfile",
      "https://api.socialapi.me/twitter/user/missing"
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      status: "error",
      message: "User not found",
    });
    assert.equal(mutationArgs.length, 2);
    const recordedRequest = mutationArgs[1] as Record<string, unknown>;
    assert.equal(recordedRequest.provider, "socialapi");
    assert.equal(recordedRequest.outcome, "error");
    assert.equal(recordedRequest.consumer, "test.missingProfile");
    assert.equal(recordedRequest.endpoint, "/twitter/user/missing");
    assert.equal(recordedRequest.httpStatus, 404);
    assert.equal(recordedRequest.errorCode, "unknown");
    assert.equal(recordedRequest.healthEvidence, true);
    assert.equal(typeof recordedRequest.errorMessage, "string");
    assert.equal(typeof recordedRequest.durationMs, "number");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider list-price estimates use returned billable units", () => {
  assert.equal(estimateSocialApiBillableUnits({ tweets: [{}, {}, {}] }), 3);
  assert.equal(SOCIAL_API_COST_PER_ENTITY_USD * 1_000, 0.2);
  assert.equal(EXA_SEARCH_COST_PER_REQUEST_USD * 1_000, 7);
  assert.equal(EXA_CONTENT_COST_PER_PAGE_USD * 1_000, 1);
});

test("grounding cache freshness is bounded", () => {
  const now = 10_000_000;
  assert.equal(isAutoPlanGroundingStageFresh(now - 1_000, now), true);
  assert.equal(isAutoPlanGroundingStageFresh(undefined, now), false);
  assert.equal(
    isAutoPlanGroundingStageFresh(now - 7 * 60 * 60 * 1_000, now),
    false
  );
});

test("all SocialAPI HTTP calls route through the tracked fetch helper", () => {
  const sourceFiles = [
    "convex/socialapi.ts",
    "convex/socialapiMonitors.ts",
    "convex/prospectMonitors.ts",
    "convex/styleMonitorActions.ts",
    "convex/styleAnalysisActions.ts",
    "convex/interactionsActions.ts",
    "convex/outreachRecovery.ts",
    "convex/agents/outreach/tools/socialContextShared.ts",
    "convex/integrations/twitter/searchPosts.ts",
    "convex/integrations/twitter/searchUserPosts.ts",
    "convex/integrations/twitter/getProfile.ts",
    "convex/integrations/twitter/getThread.ts",
    "convex/integrations/twitter/similarProfiles.ts",
  ];
  for (const sourceFile of sourceFiles) {
    const source = readFileSync(`${ROOT}/${sourceFile}`, "utf8");
    assert.match(source, /fetchSocialApi/);
    assert.doesNotMatch(source, /await acquireSocialApiBudget/);
  }
});

test("workspace status shows end-user feature names with consistent X/Twitter copy", () => {
  const statusSource = readFileSync(
    `${ROOT}/convex/lib/workspaceSystem.ts`,
    "utf8"
  );
  const rowSource = readFileSync(
    `${ROOT}/features/webapp/ui/components/WorkspaceFeatureStatusRow.tsx`,
    "utf8"
  );
  assert.match(statusSource, /label: "X\/Twitter"/);
  assert.match(statusSource, /label: "LinkedIn"/);
  assert.match(rowSource, /scroll-fade-x/);
  assert.match(rowSource, /useActiveUseCaseLabels/);
  assert.match(rowSource, /variant="outline"/);
  assert.match(rowSource, /rounded-sm/);
  assert.match(rowSource, /`\$\{entitySingular\} discovery`/);
  assert.doesNotMatch(rowSource, /tabIndex/);
});

test("workspace status surfaces share one semantic color mapping", () => {
  assert.equal(
    getWorkspaceSystemStatusDotClassName("running"),
    "bg-emerald-500"
  );
  assert.equal(
    getWorkspaceSystemStatusDotClassName("degraded"),
    "bg-amber-500"
  );
  assert.equal(
    getWorkspaceSystemStatusDotClassName("paused"),
    "bg-muted-foreground"
  );
  assert.equal(
    getWorkspaceSystemStatusDotClassName("attention"),
    "bg-destructive"
  );
});

test("updated keyed notifications use their latest event identity and time", () => {
  const now = Date.now();
  const notification = {
    _id: "notification",
    _creationTime: now - 3 * 24 * 60 * 60 * 1_000,
    eventUpdatedAt: now,
    eventVersion: 2,
  };

  assert.equal(getOutreachNotificationEventTimestamp(notification), now);
  assert.equal(
    getOutreachNotificationEventKey(notification),
    `notification:2:${now}`
  );
});

test("failed plans retry automatically only after provider health is restored", () => {
  const recoverySource = readFileSync(
    `${ROOT}/convex/workflows/autoPlanRecovery.ts`,
    "utf8"
  );
  const cronSource = readFileSync(`${ROOT}/convex/crons.ts`, "utf8");
  const outreachSource = readFileSync(`${ROOT}/convex/outreach.ts`, "utf8");

  assert.match(recoverySource, /getUnhealthyProviders/);
  assert.match(recoverySource, /claimFailedAutoPlanRecoveryBatchGlobal/);
  assert.match(recoverySource, /retryFailedAutoPlansCron/);
  assert.match(recoverySource, /probeAutoPlanProviderHealth/);
  assert.match(
    cronSource,
    /retry failed automatic plans after provider recovery/
  );
  assert.match(outreachSource, /on X\/Twitter/);
  assert.doesNotMatch(
    outreachSource,
    /messageParts\.push\(`\$\{twitterSaved\} on X`\)/
  );
  assert.equal(
    normalizeNotificationCopy("14 on X", "prospects_found"),
    "14 on X/Twitter"
  );
  assert.equal(
    normalizeNotificationCopy(
      "X's public API hit an X API policy mismatch.",
      "social_action_failed"
    ),
    "The X/Twitter public API hit an X/Twitter API policy mismatch."
  );
});
