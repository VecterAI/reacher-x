import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import type { StructuredCall } from "../../core/calls/llm";
import type { BenchmarkWorkspace } from "../../core/execution/convex";
import type { BlindInput, JudgeCaller } from "../../core/judging/judges";
import { SharedKeyConflict, WorkspaceGate } from "../../core/steps/keyGate";

// Synthetic calls only; nothing reaches a model.
const workspace: BenchmarkWorkspace = {
  workspaceId: "w1",
  createdAt: 1,
  label: "run_p01_on",
};
const structured: StructuredCall = async (model, request) => ({
  output: request.schema.parse({ ok: true }),
  modelObserved: model,
  costUsd: 0,
  latencyMs: 1,
});
const judge: JudgeCaller = async (model) => ({
  output: {},
  modelObserved: model,
  costUsd: 0,
});
const request = {
  system: "s",
  prompt: "p",
  schema: z.object({ ok: z.boolean() }),
};
const input: BlindInput = {
  caseId: "00000000-0000-4000-8000-000000000001",
  prompt: "Synthetic prompt",
  referenceDate: "2026-11-15T00:00:00Z",
  definitionNotes: [],
  criteria: [{ id: "fit", requirement: "Synthetic", required: true }],
  entity: {
    prospectType: "organization",
    name: "Synthetic Company",
    profileUrl: null,
    location: null,
    description: null,
    evidence: [],
    domain: null,
    industry: null,
    employeeCount: null,
  },
};

test("no judge or harness model call runs while a workspace is running", async () => {
  const gate = new WorkspaceGate();
  const tracked: (string | null)[] = [];
  const track = gate.tracking(async (item) => {
    tracked.push(item?.workspaceId ?? null);
  });
  const filters = gate.structured(structured, "The shared filter step");
  const clay = gate.step(
    (_step, model, input) => structured(model, input),
    "Clay's harness model call"
  );
  const judged = gate.judge(judge);

  await track(workspace);
  assert.equal(gate.active, "run_p01_on");
  await assert.rejects(filters("m", request), SharedKeyConflict);
  await assert.rejects(
    clay("query#1", "m", request),
    /Clay's harness model call cannot run/
  );
  await assert.rejects(judged("m", input), SharedKeyConflict);

  // Cleared only once the workspace is confirmed stopped.
  await track(null);
  assert.equal(gate.active, null);
  assert.deepEqual((await filters("m", request)).output, { ok: true });
  assert.equal((await judged("m", input)).modelObserved, "m");
  assert.deepEqual(tracked, ["w1", null]);
});

test("a workspace cannot start while a model call is still running", async () => {
  const gate = new WorkspaceGate();
  let release: () => void = () => {};
  const slow: StructuredCall = (model, payload) =>
    new Promise((resolve) => {
      release = () => resolve(structured(model, payload));
    });
  const pending = gate.structured(slow, "A judge call")("m", request);
  const track = gate.tracking(async () => undefined);
  await assert.rejects(track(workspace), SharedKeyConflict);
  release();
  await pending;
  await track(workspace);
  assert.equal(gate.active, "run_p01_on");
});
