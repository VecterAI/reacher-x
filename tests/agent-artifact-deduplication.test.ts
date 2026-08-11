import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getAgentArtifactsFromToolResult,
  getSupersededArtifactKeysByToolCallId,
  getToolResultArtifactSemanticKeys,
} from "../features/agent/lib/toolArtifacts";
import {
  createAttachmentPreviewArtifact,
  createPlanPreviewArtifact,
  getAgentArtifactSemanticKey,
} from "../shared/lib/json-render/agentArtifacts";

function createAttachmentArtifact(...attachmentRefs: string[]) {
  const artifact = createAttachmentPreviewArtifact({
    attachments: attachmentRefs.map((attachmentRef, index) => ({
      attachmentRef,
      fileName: `file-${index + 1}.png`,
      displayName: `File ${index + 1}`,
      mimeType: "image/png",
      mediaKind: "image",
      size: 128,
      uploadedAt: index + 1,
      mediaUrl: `https://example.com/file-${index + 1}.png`,
    })),
  });

  assert.ok(artifact);
  return artifact;
}

function createPlanArtifact(planId: string, rationale: string) {
  const artifact = createPlanPreviewArtifact({
    planId,
    prospectId: "prospect-1",
    status: "draft",
    rationale,
    tasks: [],
  });

  assert.ok(artifact);
  return artifact;
}

test("plan artifacts use the durable plan id as their semantic identity", () => {
  const artifact = createPlanArtifact("plan-1", "Initial strategy");

  assert.equal(getAgentArtifactSemanticKey(artifact), "PlanPreviewCard:plan-1");
});

test("duplicate plan artifacts inside one tool result render once", () => {
  const artifact = createPlanArtifact("plan-1", "Initial strategy");

  const artifacts = getAgentArtifactsFromToolResult({
    artifact,
    artifacts: [artifact],
  });

  assert.equal(artifacts.length, 1);
  assert.deepEqual(getToolResultArtifactSemanticKeys({ artifact }), [
    "PlanPreviewCard:plan-1",
  ]);
});

test("attachment preview artifacts preserve ordered attachment identity", () => {
  const artifact = createAttachmentArtifact("attachment_2", "attachment_1");

  assert.equal(
    getAgentArtifactSemanticKey(artifact),
    "AttachmentPreview:attachment_2,attachment_1"
  );
  assert.equal(getAgentArtifactsFromToolResult({ artifact }).length, 1);
});

test("only the latest copy of the same plan artifact remains visible per turn", () => {
  const initialArtifact = createPlanArtifact("plan-1", "Initial strategy");
  const updatedArtifact = createPlanArtifact("plan-1", "Updated strategy");

  const supersededKeys = getSupersededArtifactKeysByToolCallId([
    {
      toolCallId: "get-plan",
      result: {
        artifact: initialArtifact,
        plan: { id: "plan-1" },
      },
    },
    {
      toolCallId: "refine-plan",
      result: {
        artifact: updatedArtifact,
        plan: { id: "plan-1" },
      },
    },
  ]);

  assert.deepEqual(
    [...supersededKeys.get("get-plan")!],
    ["PlanPreviewCard:plan-1"]
  );
  assert.equal(supersededKeys.has("refine-plan"), false);
});

test("different plans remain visible in the same assistant turn", () => {
  const supersededKeys = getSupersededArtifactKeysByToolCallId([
    {
      toolCallId: "plan-a",
      result: { artifact: createPlanArtifact("plan-a", "Strategy A") },
    },
    {
      toolCallId: "plan-b",
      result: { artifact: createPlanArtifact("plan-b", "Strategy B") },
    },
  ]);

  assert.equal(supersededKeys.size, 0);
});

test("the chat renderer applies semantic deduplication to tool cards", () => {
  const source = readFileSync("features/agent/ui/AgentChat.tsx", "utf8");

  assert.match(source, /getSupersededArtifactKeysByToolCallId\(toolCalls\)/);
  assert.match(
    source,
    /supersededArtifactKeysByToolCallId=\{\s*supersededArtifactKeysByToolCallId\s*\}/
  );
  assert.match(source, /supersededArtifactKeys\?\.has\(semanticKey\)/);
});
