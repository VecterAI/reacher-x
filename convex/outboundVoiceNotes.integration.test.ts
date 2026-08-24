/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

const modules = import.meta.glob("./**/*.ts");

async function seedVoiceNoteUsers(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "voice-intent-owner",
      email: "voice-intent-owner@example.com",
    });
    const outsiderId = await ctx.db.insert("users", {
      workosUserId: "voice-intent-outsider",
      email: "voice-intent-outsider@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Voice intent workspace",
      description: "Voice intent tests",
      isDefault: true,
      updatedAt: 1,
    });
    const prospectId = await ctx.db.insert("prospects", {
      workspaceId,
      userId,
      platform: "linkedin",
      origin: "workspace_discovery",
      externalId: "voice-intent-linkedin",
      data: {},
      status: "new",
      updatedAt: 1,
    });
    const storageId = await ctx.storage.store(new Blob(["first"]));
    const otherStorageId = await ctx.storage.store(new Blob(["second"]));
    return { outsiderId, prospectId, storageId, otherStorageId, userId };
  });
}

describe("outbound voice note upload intents", () => {
  test("binds one authenticated intent to one prospect and storage object", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedVoiceNoteUsers(t);
    const owner = t.withIdentity({ subject: "voice-intent-owner" });
    const outsider = t.withIdentity({ subject: "voice-intent-outsider" });

    const upload = await owner.mutation(
      api.outboundVoiceNotes.generateUploadUrl,
      { prospectId: seeded.prospectId }
    );
    expect(upload.uploadUrl).toMatch(/^https?:\/\//u);

    await expect(
      outsider.mutation(api.outboundVoiceNotes.generateUploadUrl, {
        prospectId: seeded.prospectId,
      })
    ).rejects.toThrow();

    await expect(
      t.mutation(internal.outboundVoiceNotes.claimUploadIntentInternal, {
        uploadIntentId: upload.uploadIntentId,
        userId: seeded.outsiderId,
        prospectId: seeded.prospectId,
        storageId: seeded.storageId,
        now: getCurrentUTCTimestamp(),
      })
    ).rejects.toThrow("authorization");

    await expect(
      t.mutation(internal.outboundVoiceNotes.claimUploadIntentInternal, {
        uploadIntentId: upload.uploadIntentId,
        userId: seeded.userId,
        prospectId: seeded.prospectId,
        storageId: seeded.storageId,
        now: getCurrentUTCTimestamp(),
      })
    ).resolves.toMatchObject({ kind: "claimed" });

    await expect(
      t.mutation(internal.outboundVoiceNotes.claimUploadIntentInternal, {
        uploadIntentId: upload.uploadIntentId,
        userId: seeded.userId,
        prospectId: seeded.prospectId,
        storageId: seeded.otherStorageId,
        now: getCurrentUTCTimestamp(),
      })
    ).rejects.toThrow("already used");
  });
});
