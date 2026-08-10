import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentOpsMemoryHref } from "../shared/lib/urls/agentOpsHref";

test("memory artifact links open the matching Agent Ops detail panel", () => {
  assert.equal(
    buildAgentOpsMemoryHref("memory/id with spaces"),
    "/agent-ops?tab=memory&panel=memory&memoryId=memory%2Fid+with+spaces"
  );
});
