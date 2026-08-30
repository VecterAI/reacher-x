import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatQualificationModelFailure,
  getQualificationFailureRetryAt,
  parseQualificationModelFailure,
} from "../convex/lib/qualificationFailureCore";

const qualificationCoreSource = readFileSync(
  "convex/lib/qualificationCore.ts",
  "utf8"
);
const qualificationWorkflowSource = readFileSync(
  "convex/workflows/qualification.ts",
  "utf8"
);
const qualificationValidatorSource = readFileSync(
  "convex/validators.ts",
  "utf8"
);

test("model failures throw instead of becoming disqualified results", () => {
  const catchBlock = qualificationCoreSource.slice(
    qualificationCoreSource.indexOf("} catch (error)"),
    qualificationCoreSource.indexOf(
      "\n  }\n}",
      qualificationCoreSource.indexOf("} catch (error)")
    )
  );

  assert.match(catchBlock, /throw new QualificationEvaluationError/);
  assert.doesNotMatch(catchBlock, /status:\s*"disqualified"/);
});

test("failed durable workflows clear their lease without changing status", () => {
  assert.match(
    qualificationWorkflowSource,
    /onComplete:[\s\S]*handleQualificationComplete/
  );
  const completionHandler = qualificationWorkflowSource.slice(
    qualificationWorkflowSource.indexOf(
      "export const handleQualificationComplete"
    )
  );
  assert.match(completionHandler, /qualificationWorkflowId:\s*undefined/);
  assert.doesNotMatch(completionHandler, /qualificationStatus:/);
});

test("model failures retain provider, model, attempts, and original error", () => {
  const formatted = formatQualificationModelFailure({
    provider: "OpenRouter",
    model: "example/model",
    attemptCount: 2,
    message: "Structured response did not validate",
  });

  assert.deepEqual(parseQualificationModelFailure(formatted), {
    provider: "OpenRouter",
    model: "example/model",
    attemptCount: 2,
    message: "Structured response did not validate",
  });
});

test("legacy exhausted failures without nextRetryAt become due after backoff", () => {
  const failedAt = Date.parse("2026-08-29T12:00:00.000Z");
  assert.equal(
    getQualificationFailureRetryAt({ failedAt, workflowAttemptCount: 2 }),
    failedAt + 10 * 60 * 1000
  );
});

test("qualification uses native structured output and a stronger fallback", () => {
  assert.match(qualificationCoreSource, /nativeStructuredOutput:\s*true/);
  assert.match(
    qualificationCoreSource,
    /fallbackRouting:\s*routing === "onboarding" \? undefined : "onboarding"/
  );
  assert.match(
    qualificationCoreSource,
    /structuredFailure\?\.attempts\.length \?\? 2/
  );
});

test("technical failures keep one rate-bounded durable retry scheduled", () => {
  const completionHandler = qualificationWorkflowSource.slice(
    qualificationWorkflowSource.indexOf(
      "export const handleQualificationComplete"
    ),
    qualificationWorkflowSource.indexOf("export const startQualification")
  );
  assert.match(completionHandler, /getQualificationFailureRetryDelayMs/);
  assert.match(completionHandler, /ctx\.scheduler\.runAt/);
  assert.match(completionHandler, /expectedFailureAt:\s*now/);
  assert.match(qualificationValidatorSource, /workflowAttemptCount:/);
  assert.match(qualificationValidatorSource, /nextRetryAt:/);
});
