import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("main and setup agents use the shared workspace memory context handler", async () => {
  const agentSource = await source("convex/agents/index.ts");
  assert.match(
    agentSource,
    /contextHandler:\s*createWorkspaceMemoryContextHandler\("main"\)/
  );
  assert.match(
    agentSource,
    /contextHandler:\s*createWorkspaceMemoryContextHandler\("setup"\)/
  );
});

test("every downstream generation surface consumes shared memory context", async () => {
  const [memory, autoPlan, adaptive] = await Promise.all([
    source("convex/memory.ts"),
    source("convex/autoPlanActions.ts"),
    source("convex/adaptiveOutreachActions.ts"),
  ]);
  assert.match(memory, /surface:\s*"manual_prospect"/);
  assert.match(memory, /surface:\s*"qualification"/);
  assert.match(autoPlan, /buildWorkspaceMemoryContextInternal/);
  assert.match(autoPlan, /surface:\s*"auto_plan"/);
  assert.match(autoPlan, /workspaceMemoryContext\.prompt/);
  assert.match(adaptive, /buildWorkspaceMemoryContextInternal/);
  assert.match(adaptive, /surface:\s*"adaptive_outreach"/);
  assert.match(adaptive, /workspaceMemoryContext\.prompt/);
});

test("generated downstream output is checked against the same operator instructions", async () => {
  const [memory, qualification, autoPlan, adaptive, generatePlan, refinePlan] =
    await Promise.all([
      source("convex/memory.ts"),
      source("convex/lib/qualificationCore.ts"),
      source("convex/autoPlanActions.ts"),
      source("convex/adaptiveOutreachActions.ts"),
      source("convex/agents/outreach/tools/generatePlan.ts"),
      source("convex/agents/outreach/tools/refinePlan.ts"),
    ]);
  assert.match(memory, /evaluateWorkspaceMemoryCompliance/);
  assert.match(qualification, /runWithWorkspaceMemoryCompliance/);
  assert.match(autoPlan, /workspaceMemoryContext\.complianceInstructions/);
  assert.match(autoPlan, /runWithWorkspaceMemoryCompliance/);
  assert.match(adaptive, /workspaceMemoryContext\.complianceInstructions/);
  assert.match(generatePlan, /evaluateWorkspaceMemoryComplianceInternal/);
  assert.match(refinePlan, /evaluateWorkspaceMemoryComplianceInternal/);
});
