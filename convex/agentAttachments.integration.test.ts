/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { createOutreachPlan } from "./lib/outreachCore";
import {
  assertOutreachMediaCapability,
  resolveOwnedOutreachMedia,
} from "./lib/mediaCapabilityCore";
import { upsertCanonicalWorkspaceMemory } from "./lib/workspaceMemoryCore";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedProspect(t: ReturnType<typeof convexTest>, suffix: string) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: `workos-${suffix}`,
      email: `${suffix}@example.com`,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: `Workspace ${suffix}`,
      description: "Attachment reference tests",
      isDefault: true,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform: "twitter",
      origin: "workspace_discovery",
      externalId: `external-${suffix}`,
      data: {},
      status: "new",
      qualificationStatus: "qualified",
      displayName: `Prospect ${suffix}`,
      updatedAt: 1,
    });
    return { userId, workspaceId, prospectId };
  });
}

describe("prospect Agent attachment references", () => {
  test("resolves verified memory-bound attachments and rejects cross-workspace bindings", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedProspect(t, "memory-binding");
    const foreign = await seedProspect(t, "foreign-memory-binding");

    const { uploadId, foreignUploadId } = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob(["case-study"], { type: "application/pdf" })
      );
      const foreignStorageId = await ctx.storage.store(
        new Blob(["foreign"], { type: "image/png" })
      );
      const uploadId = await ctx.db.insert("mediaUploads", {
        storageId,
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        fileName: "case-study.pdf",
        mimeType: "application/pdf",
        size: 10,
        uploadedAt: 1,
      });
      const foreignUploadId = await ctx.db.insert("mediaUploads", {
        storageId: foreignStorageId,
        userId: foreign.userId,
        workspaceId: foreign.workspaceId,
        fileName: "foreign.png",
        mimeType: "image/png",
        size: 10,
        uploadedAt: 1,
      });

      await upsertCanonicalWorkspaceMemory(ctx.db, {
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        source: "operator",
        namespace: "patterns",
        title: "Use the case study",
        summary: "Share proof when the prospect asks for results.",
        canonicalContent: "Use the case study when proof is relevant.",
        conflictKey: "outreach.proof_attachment",
        confidence: 1,
        impactScore: 1,
        attachmentUploadIds: [uploadId],
      });

      return { uploadId, foreignUploadId };
    });

    const resolved = await t.query(
      internal.workspaceAttachments.getMemoryAttachmentIdsForAgentInternal,
      {
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        memoryKey: "outreach.proof_attachment",
      }
    );
    expect(resolved).toEqual([uploadId]);

    await expect(
      t.run(async (ctx) => {
        await upsertCanonicalWorkspaceMemory(ctx.db, {
          userId: seeded.userId,
          workspaceId: seeded.workspaceId,
          source: "operator",
          namespace: "patterns",
          title: "Invalid foreign file",
          summary: "This must not be stored.",
          canonicalContent: "Never cross workspace boundaries.",
          conflictKey: "outreach.invalid_attachment",
          confidence: 1,
          impactScore: 1,
          attachmentUploadIds: [foreignUploadId],
        });
      })
    ).rejects.toThrow("Workspace memory attachment validation failed");
  });

  test("keeps recent selected attachments available on follow-up turns", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedProspect(t, "follow-up");
    const threadId = "prospect-attachment-thread";
    const { videoUploadId, imageUploadId } = await t.run(async (ctx) => {
      const videoStorageId = await ctx.storage.store(
        new Blob(["video"], { type: "video/mp4" })
      );
      const imageStorageId = await ctx.storage.store(
        new Blob(["image"], { type: "image/png" })
      );
      const videoUploadId = await ctx.db.insert("mediaUploads", {
        storageId: videoStorageId,
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        fileName: "demo.mp4",
        mimeType: "video/mp4",
        size: 5,
        uploadedAt: 1,
      });
      const imageUploadId = await ctx.db.insert("mediaUploads", {
        storageId: imageStorageId,
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        fileName: "screenshot.png",
        mimeType: "image/png",
        size: 5,
        uploadedAt: 2,
      });

      await ctx.db.insert("agentMessageContexts", {
        threadId,
        messageId: "attachment-message",
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        prospectId: seeded.prospectId,
        promptTextSource: "user",
        taggedEntities: [],
        attachments: [
          {
            uploadId: String(videoUploadId),
            fileName: "demo.mp4",
          },
        ],
        createdAt: 1,
      });
      await ctx.db.insert("agentMessageContexts", {
        threadId,
        messageId: "follow-up-message",
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        prospectId: seeded.prospectId,
        promptTextSource: "user",
        taggedEntities: [],
        attachments: [],
        createdAt: 2,
      });

      return { videoUploadId, imageUploadId };
    });

    const followUpReferences = await t.query(
      internal.agentAttachments.listAvailableForAgentTool,
      {
        threadId,
        messageId: "follow-up-message",
        userId: seeded.userId,
      }
    );
    expect(followUpReferences).toMatchObject([
      {
        reference: "attachment_1",
        uploadId: videoUploadId,
        fileName: "demo.mp4",
        mediaKind: "video",
        selectedInCurrentMessage: false,
      },
    ]);

    await t.run(async (ctx) => {
      await ctx.db.insert("agentMessageContexts", {
        threadId,
        messageId: "new-attachment-message",
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        prospectId: seeded.prospectId,
        promptTextSource: "user",
        taggedEntities: [],
        attachments: [
          {
            uploadId: String(imageUploadId),
            fileName: "screenshot.png",
          },
        ],
        createdAt: 3,
      });
    });

    const currentReferences = await t.query(
      internal.agentAttachments.listAvailableForAgentTool,
      {
        threadId,
        messageId: "new-attachment-message",
        userId: seeded.userId,
      }
    );
    expect(currentReferences).toMatchObject([
      {
        reference: "attachment_1",
        uploadId: imageUploadId,
        mediaKind: "image",
        selectedInCurrentMessage: true,
      },
      {
        reference: "attachment_2",
        uploadId: videoUploadId,
        mediaKind: "video",
        selectedInCurrentMessage: false,
      },
    ]);
  });

  test("persists backend-resolved upload ids during plan refinement", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedProspect(t, "plan-update");
    const { planId, uploadId, mediaUrl } = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob(["video"], { type: "video/mp4" })
      );
      const uploadId = await ctx.db.insert("mediaUploads", {
        storageId,
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        fileName: "demo.mp4",
        mimeType: "video/mp4",
        size: 5,
        uploadedAt: 1,
      });
      const mediaUrl = await ctx.storage.getUrl(storageId);
      if (!mediaUrl) {
        throw new Error("Test media URL was not created.");
      }
      const planId = await createOutreachPlan(ctx, {
        prospectId: seeded.prospectId,
        workspaceId: seeded.workspaceId,
        userId: seeded.userId,
        strategy: {
          rationale: "Start with a concise DM.",
          valueProposition: "Relevant demo",
          tone: "helpful peer",
        },
        tasks: [
          {
            type: "dm",
            description: "Send the introduction",
            timing: { type: "immediate" },
            content: "Quick introduction",
          },
        ],
      });
      return { planId, uploadId, mediaUrl };
    });

    await t.mutation(internal.outreach.updatePlan, {
      planId,
      tasks: [
        {
          type: "dm",
          description: "Send the introduction with the demo",
          timing: { type: "immediate" },
          content: "Quick introduction",
          mediaUrls: [mediaUrl],
          mediaUploadIds: [uploadId],
          mediaDescriptions: ["Product demo"],
          mediaKinds: ["video"],
        },
      ],
    });

    const updated = await t.query(internal.outreach.getPlanInternal, {
      planId,
    });
    expect(updated?.tasks[0]).toMatchObject({
      mediaUrls: [mediaUrl],
      mediaUploadIds: [uploadId],
      mediaDescriptions: ["Product demo"],
      mediaKinds: ["video"],
    });
  });

  test("resolves a verified PDF upload ID for LinkedIn DMs and fails closed elsewhere", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedProspect(t, "pdf-linkedin-dm");

    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob(["pdf"], { type: "application/pdf" })
      );
      const uploadId = await ctx.db.insert("mediaUploads", {
        storageId,
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        fileName: "case-study.pdf",
        mimeType: "application/pdf",
        size: 3,
        uploadedAt: 1,
      });
      const mediaUrl = await ctx.storage.getUrl(storageId);
      if (!mediaUrl) throw new Error("Test PDF URL was not created.");

      const resolved = await resolveOwnedOutreachMedia(ctx, {
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        mediaUrls: [mediaUrl],
        mediaUploadIds: [uploadId],
      });

      expect(resolved).toMatchObject([
        {
          uploadId,
          fileName: "case-study.pdf",
          mimeType: "application/pdf",
          kind: "file",
        },
      ]);
      expect(() =>
        assertOutreachMediaCapability({
          platform: "linkedin",
          surface: "dm",
          media: resolved,
        })
      ).not.toThrow();
      expect(() =>
        assertOutreachMediaCapability({
          platform: "linkedin",
          surface: "comment",
          media: resolved,
        })
      ).toThrow(/cannot be attached to a LinkedIn comment/);
      expect(() =>
        assertOutreachMediaCapability({
          platform: "twitter",
          surface: "dm",
          media: resolved,
        })
      ).toThrow(/cannot be attached to X\/Twitter/);
    });
  });

  test("keeps main Agent attachments workspace-scoped across turns", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedProspect(t, "main-workspace-scope");
    const other = await seedProspect(t, "other-workspace-scope");
    const threadId = "main-attachment-thread";
    const { firstUploadId, secondUploadId } = await t.run(async (ctx) => {
      const firstStorageId = await ctx.storage.store(
        new Blob(["first"], { type: "image/png" })
      );
      const secondStorageId = await ctx.storage.store(
        new Blob(["second"], { type: "video/mp4" })
      );
      const foreignStorageId = await ctx.storage.store(
        new Blob(["foreign"], { type: "image/png" })
      );
      const firstUploadId = await ctx.db.insert("mediaUploads", {
        storageId: firstStorageId,
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        fileName: "first.png",
        mimeType: "image/png",
        size: 5,
        uploadedAt: 1,
      });
      const secondUploadId = await ctx.db.insert("mediaUploads", {
        storageId: secondStorageId,
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        fileName: "second.mp4",
        mimeType: "video/mp4",
        size: 6,
        uploadedAt: 2,
      });
      const foreignUploadId = await ctx.db.insert("mediaUploads", {
        storageId: foreignStorageId,
        userId: other.userId,
        workspaceId: other.workspaceId,
        fileName: "foreign.png",
        mimeType: "image/png",
        size: 7,
        uploadedAt: 3,
      });
      await ctx.db.insert("agentMessageContexts", {
        threadId,
        messageId: "main-first",
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        promptTextSource: "user",
        taggedEntities: [],
        attachments: [
          { uploadId: String(firstUploadId), fileName: "first.png" },
        ],
        createdAt: 1,
      });
      await ctx.db.insert("agentMessageContexts", {
        threadId,
        messageId: "main-second",
        userId: seeded.userId,
        workspaceId: seeded.workspaceId,
        promptTextSource: "user",
        taggedEntities: [
          {
            id: `attachment:${String(foreignUploadId)}`,
            kind: "attachment",
            entityId: String(foreignUploadId),
            label: "foreign.png",
            mentionText: "Attachment: foreign.png",
            secondaryLabel: "Workspace attachment",
            verified: false,
            referenceText: "foreign.png",
            attachmentMediaKind: "image",
          },
        ],
        attachments: [
          { uploadId: String(secondUploadId), fileName: "second.mp4" },
        ],
        createdAt: 2,
      });
      return { firstUploadId, secondUploadId };
    });

    const references = await t.query(
      internal.agentAttachments.listAvailableForAgentTool,
      {
        threadId,
        messageId: "main-second",
        userId: seeded.userId,
      }
    );
    expect(references).toMatchObject([
      {
        reference: "attachment_1",
        uploadId: secondUploadId,
        selectedInCurrentMessage: true,
      },
      {
        reference: "attachment_2",
        uploadId: firstUploadId,
        selectedInCurrentMessage: false,
      },
    ]);
    expect(references).toHaveLength(2);
  });

  test("deletes a newly uploaded blob when post-upload validation rejects it", async () => {
    const t = convexTest(schema, modules);
    const suffix = "invalid-upload-cleanup";
    const seeded = await seedProspect(t, suffix);
    const storageId = await t.run(
      async (ctx) =>
        await ctx.storage.store(
          new Blob(["archive"], { type: "application/zip" })
        )
    );
    const authenticated = t.withIdentity({ subject: `workos-${suffix}` });

    const result = await authenticated.mutation(
      internal.mediaUploadMutations.storeMediaMetadataInternal,
      {
        mediaId: storageId,
        fileName: "unsupported.zip",
        mimeType: "application/zip",
        size: 5,
        workspaceId: seeded.workspaceId,
      }
    );

    expect(result).toMatchObject({
      success: false,
      error:
        "unsupported.zip is not compatible with any supported X/Twitter or LinkedIn attachment destination.",
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.system.get("_storage", storageId)).toBeNull();
      expect(await ctx.db.query("mediaUploads").collect()).toHaveLength(0);
    });
  });
});
