import type { WorkflowStatus } from "@convex-dev/workflow";
import { describe, expect, test } from "vitest";
import {
  getSetupWorkflowRecoveryDecision,
  SETUP_WORKFLOW_MAX_RECOVERY_ATTEMPTS,
  SETUP_WORKFLOW_STALE_AFTER_MS,
} from "./setupSessionCore";

const now = 1_000_000_000;
const inProgress = { type: "inProgress", running: [] } satisfies WorkflowStatus;

function session(
  overrides: Partial<{
    status:
      | "awaiting_input"
      | "generating_profiles"
      | "provisioning_preview_workspace";
    workflowId: string;
    workflowRecoveryAttempts: number;
    statusUpdatedAt: number;
    lastAgentActionAt: number;
    generationRequestedAt: number;
  }> = {}
) {
  return {
    status: "generating_profiles" as const,
    workflowId: "workflow-1",
    workflowRecoveryAttempts: 0,
    statusUpdatedAt: now - SETUP_WORKFLOW_STALE_AFTER_MS - 1,
    lastAgentActionAt: undefined,
    generationRequestedAt: undefined,
    ...overrides,
  };
}

describe("setup workflow recovery decisions", () => {
  test("never treats a human wait as stale", () => {
    expect(
      getSetupWorkflowRecoveryDecision({
        session: session({ status: "awaiting_input" }),
        workflowStatus: inProgress,
        now,
      })
    ).toEqual({ kind: "none", reason: "waiting_for_user" });
  });

  test("leaves recent machine progress alone", () => {
    expect(
      getSetupWorkflowRecoveryDecision({
        session: session({ statusUpdatedAt: now - 1_000 }),
        workflowStatus: inProgress,
        now,
      })
    ).toEqual({ kind: "none", reason: "healthy" });
  });

  test("replaces stale and failed component workflows", () => {
    expect(
      getSetupWorkflowRecoveryDecision({
        session: session(),
        workflowStatus: inProgress,
        now,
      })
    ).toEqual({ kind: "replace", reason: "stale_machine_progress" });
    expect(
      getSetupWorkflowRecoveryDecision({
        session: session(),
        workflowStatus: { type: "failed", error: "boom" },
        now,
      })
    ).toEqual({ kind: "replace", reason: "component_failed" });
  });

  test("fails clearly after the bounded recovery budget", () => {
    expect(
      getSetupWorkflowRecoveryDecision({
        session: session({
          workflowRecoveryAttempts: SETUP_WORKFLOW_MAX_RECOVERY_ATTEMPTS,
        }),
        workflowStatus: inProgress,
        now,
      })
    ).toEqual({ kind: "fail", reason: "recovery_exhausted" });
  });
});
