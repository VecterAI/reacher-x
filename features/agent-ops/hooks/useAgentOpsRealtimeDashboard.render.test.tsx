// @vitest-environment node
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { describe, expect, test } from "vitest";
import { useAgentOpsRealtimeDashboard } from "./useAgentOpsRealtimeDashboard";

// Exercise real React and Convex hooks: changing the useQueries request identity
// during render otherwise causes an infinite render loop, even before data arrives.
describe("Agent Ops React subscription lifecycle", () => {
  test("renders skipped and pending subscriptions without a render loop", async () => {
    const client = new ConvexReactClient("https://qa.convex.cloud");
    function Pending({ skip }: { skip: boolean }) {
      const result = useAgentOpsRealtimeDashboard(
        skip
          ? "skip"
          : {
              workspaceId: "workspace-test" as never,
              range: "30d",
              tab: "overview",
              nowMs: Date.UTC(2026, 8, 7, 12),
            }
      );
      return createElement(
        "div",
        null,
        result.isPending ? "pending" : "skipped"
      );
    }
    try {
      for (const skip of [true, false]) {
        expect(
          renderToString(
            createElement(
              ConvexProvider,
              { client },
              createElement(Pending, { skip })
            )
          )
        ).toContain(skip ? "skipped" : "pending");
      }
    } finally {
      await client.close();
    }
  });
});
