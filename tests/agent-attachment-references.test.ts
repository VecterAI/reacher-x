import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Id } from "../convex/_generated/dataModel";
import {
  buildAgentAttachmentReferenceContext,
  resolveAgentAttachmentMediaInput,
  restoreExistingMediaUploadIds,
  type AgentAttachmentToolReference,
} from "../convex/lib/agentAttachmentReferenceCore";

const demoReference: AgentAttachmentToolReference = {
  reference: "attachment_1",
  uploadId: "upload-demo" as Id<"mediaUploads">,
  url: "https://example.convex.cloud/demo.mp4",
  fileName: "demo.mp4",
  mediaKind: "video",
  selectedInCurrentMessage: false,
};

test("attachment references resolve to verified backend media metadata", () => {
  assert.deepEqual(
    resolveAgentAttachmentMediaInput(
      {
        attachmentRefs: ["attachment_1"],
        mediaDescriptions: ["Product demo"],
        mediaKinds: ["image"],
      },
      [demoReference]
    ),
    {
      mediaUrls: [demoReference.url],
      mediaUploadIds: [demoReference.uploadId],
      mediaDescriptions: ["Product demo"],
      mediaKinds: ["video"],
    }
  );
});

test("attachment reference context distinguishes current and reusable files", () => {
  const context = buildAgentAttachmentReferenceContext([demoReference]);

  assert.match(context ?? "", /attachment_1: demo\.mp4/);
  assert.match(context ?? "", /selected earlier in this thread/);
  assert.match(context ?? "", /Never put storage URLs or upload IDs/);
});

test("attachment references reject unavailable or mixed media inputs", () => {
  assert.throws(
    () =>
      resolveAgentAttachmentMediaInput({ attachmentRefs: ["attachment_2"] }, [
        demoReference,
      ]),
    /attachment_2.*unavailable/
  );
  assert.throws(
    () =>
      resolveAgentAttachmentMediaInput(
        {
          attachmentRefs: ["attachment_1"],
          mediaUrls: ["https://example.com/demo.mp4"],
        },
        [demoReference]
      ),
    /not both/
  );
});

test("plan refinement restores durable upload ids for preserved media URLs", () => {
  assert.deepEqual(
    restoreExistingMediaUploadIds(
      [{ mediaUrls: [demoReference.url] }],
      [
        {
          mediaUrls: [demoReference.url],
          mediaUploadIds: [demoReference.uploadId],
        },
      ]
    ),
    [
      {
        mediaUrls: [demoReference.url],
        mediaUploadIds: [demoReference.uploadId],
      },
    ]
  );
});

test("prospect tools use attachment references instead of model-supplied storage URLs", () => {
  const promptSource = readFileSync("convex/agents/prompts.ts", "utf8");
  const refineSource = readFileSync(
    "convex/agents/outreach/tools/refinePlan.ts",
    "utf8"
  );
  const generateSource = readFileSync(
    "convex/agents/outreach/tools/generatePlan.ts",
    "utf8"
  );
  const socialSource = readFileSync(
    "convex/agents/outreach/tools/socialAction.ts",
    "utf8"
  );

  assert.match(promptSource, /attachmentRefs/);
  assert.match(promptSource, /Never invent, expose, or copy storage URLs/);
  assert.match(refineSource, /attachmentRefs: attachmentRefsSchema/);
  assert.match(generateSource, /attachmentRefs: attachmentRefsSchema/);
  assert.match(socialSource, /attachmentRefs: attachmentRefsSchema/);
});
