import { expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";

const { capture } = vi.hoisted(() => ({
  capture: {
    handler: undefined as
      | ((step: unknown, args: unknown) => Promise<unknown>)
      | undefined,
  },
}));
vi.mock("./lib/workflow", () => ({
  workflow: {
    define: (definition: { handler: typeof capture.handler }) => {
      capture.handler = definition.handler;
      return {};
    },
  },
}));
import "./workflows/prospecting";

test("missing discovery configuration stops before model calls and records an activity failure", async () => {
  const mutations: Array<{ name: string; args: Record<string, unknown> }> = [];
  const runAction = vi.fn();
  const step = {
    workflowId: "config-failure-workflow",
    runQuery: vi
      .fn()
      .mockResolvedValueOnce({ limitReached: false })
      .mockResolvedValueOnce({
        _id: "workspace",
        description: "Find founders",
        improvedDescription: "Find founders",
        icps: [
          {
            title: "Founders",
            description: "Software founders",
            painPoints: ["growth"],
            channels: ["twitter"],
            syntheticPosts: ["Need growth"],
          },
        ],
      })
      .mockResolvedValueOnce({ configured: false }),
    runMutation: vi.fn(async (ref, args) => {
      mutations.push({ name: getFunctionName(ref), args });
    }),
    runAction,
  };
  expect(capture.handler).toBeDefined();
  const result = await capture.handler!(step, { workspaceId: "workspace" });
  expect(result).toMatchObject({
    status: "error",
    reason: "Discovery service configuration missing",
    shouldContinue: false,
  });
  expect(runAction).not.toHaveBeenCalled();
  expect(mutations).toContainEqual({
    name: "workflows/prospecting:updateWorkflowStatus",
    args: { workspaceId: "workspace", status: "stopped" },
  });
  expect(mutations).toContainEqual({
    name: "memory:recordMemoryWorkflowEventInternal",
    args: {
      workspaceId: "workspace",
      eventType: "prospecting_cycle_failed",
      sourceType: "workflow_event",
      sourceId: "config-failure-workflow",
      workflowName: "prospectingWorkflow",
      payload: { reason: "search_configuration_missing" },
      eventKey:
        "prospecting:config-failure-workflow:search_configuration_missing",
    },
  });
});
