/// <reference types="vite/client" />

import agentTest from "@convex-dev/agent/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { buildAgentComposerSubmission } from "../features/agent/lib/buildAgentComposerMessage";
import { createThread } from "@convex-dev/agent";
import { api, components, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { buildResolvedTaggedEntityLine } from "./chat";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

vi.stubEnv("OPENROUTER_API_KEY", "tagged-entity-validator-test-key");
vi.stubEnv("OPENAI_API_KEY", "tagged-entity-validator-test-key");

describe("Agent message tagged entities", () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  test("creates a prospect thread with every supported tagged entity kind", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    agentTest.register(t);

    const seeded = await t.run(async (ctx) => {
      const workosUserId = "tagged-entity-validator-user";
      const userId = await ctx.db.insert("users", {
        workosUserId,
        email: "tagged-entity-validator@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Tagged entity validator workspace",
        description: "Regression coverage for Agent message tags",
        isDefault: true,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "tagged-entity-validator-prospect",
        data: {},
        status: "new",
        qualificationStatus: "qualified",
        displayName: "Tagged Prospect",
        updatedAt: 1,
      });

      return { prospectId, workosUserId };
    });

    const tagKinds = [
      "prospect",
      "plan",
      "task",
      "attachment",
      "post",
    ] as const;
    const submission = buildAgentComposerSubmission({
      input: "Use every tagged reference.",
      taggedEntities: tagKinds.map((kind) => ({
        id: `${kind}:${kind}-1`,
        entityId: `${kind}-1`,
        kind,
        label: `Tagged ${kind}`,
        mentionText: `Tagged ${kind}`,
        secondaryLabel: `${kind} reference`,
        avatarUrl: null,
        verified: false,
        referenceText: `${kind} reference`,
        attachmentSize: kind === "attachment" ? 4096 : null,
        attachmentMediaKind: kind === "attachment" ? ("file" as const) : null,
      })),
    });
    if (!submission) {
      throw new Error("Expected a tagged Agent composer submission.");
    }

    const result = await t
      .withIdentity({ subject: seeded.workosUserId })
      .mutation(api.chat.createProspectThreadWithPrompt, {
        prospectId: seeded.prospectId,
        prompt: submission.prompt,
        metadata: submission.metadata ?? undefined,
      });

    // This test owns message persistence, not model generation. Keep the queued
    // response from running after Vitest tears down the test environment.
    await t.run(async (ctx) => {
      const queued = await ctx.db.system
        .query("_scheduled_functions")
        .collect();
      expect(
        queued.some((job) => job.name === "chat:streamOutreachResponse")
      ).toBe(true);
      for (const job of queued) {
        if (job.state.kind === "pending") await ctx.scheduler.cancel(job._id);
      }
    });

    const storedContext = await t.run((ctx) =>
      ctx.db
        .query("agentMessageContexts")
        .withIndex("by_message", (q) => q.eq("messageId", result.messageId))
        .unique()
    );

    expect(storedContext?.taggedEntities.map((entity) => entity.kind)).toEqual(
      tagKinds
    );
    expect(storedContext?.taggedEntities).toHaveLength(tagKinds.length);
    for (const entity of storedContext?.taggedEntities ?? []) {
      expect(entity.attachmentSize).toBe(
        entity.kind === "attachment" ? 4096 : null
      );
      expect(entity.attachmentDisabled).toBe(false);
      expect(entity.attachmentDisabledReason).toBeNull();
    }
  });

  test("skips tags with malformed ids and keeps the valid ones", async () => {
    const t = convexTest(schema, modules);
    agentTest.register(t);
    const messageId = "malformed-tag-message";
    const tag = (
      kind: "prospect" | "plan",
      label: string,
      entityId: string
    ) => ({
      id: `${kind}:${entityId}`,
      entityId,
      kind,
      label,
      mentionText: label,
      secondaryLabel: "",
      avatarUrl: null,
      verified: false,
    });
    const { threadId, prospectId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "malformed-tag-user",
        email: "malformed-tag@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Malformed tag workspace",
        description: "Malformed tag regression",
        isDefault: true,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "malformed-tag-prospect",
        data: {},
        status: "new",
        displayName: "Jane Roe",
        updatedAt: 1,
      });
      const threadId = await createThread(ctx, components.agent, {
        userId: String(userId),
      });
      await ctx.db.insert("agentMessageContexts", {
        threadId,
        messageId,
        userId,
        promptTextSource: "user",
        // Ids pasted from another deployment are malformed here.
        taggedEntities: [
          tag("prospect", "Jane Roe", String(prospectId)),
          tag("prospect", "Ghost", "not-a-real-id"),
          tag("plan", "Ghost plan", "not-a-real-id"),
        ],
        attachments: [],
        createdAt: 1,
      });
      return { threadId, prospectId };
    });

    const context = await t.query(
      internal.chat.getAgentMessageContextInternal,
      { messageId }
    );
    expect(context?.taggedEntities.map((entity) => entity.label)).toEqual([
      "Jane Roe",
    ]);

    const selected = await t.query(
      internal.agentThreadContext.resolveSelectedContextForThread,
      { threadId }
    );
    expect(selected.prospectId).toBe(prospectId);
    expect(selected.planId).toBeNull();
  });

  test("only reads tagged records from the thread's own workspace", async () => {
    const t = convexTest(schema, modules);
    agentTest.register(t);

    const lines = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "scoped-tag-user",
        email: "scoped-tag@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Scoped tag workspace",
        description: "Tag scope regression",
        isDefault: true,
        updatedAt: 1,
      });
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "scoped-tag-prospect",
        data: {},
        status: "new",
        displayName: "Jane Roe",
        updatedAt: 1,
      });
      const planId = await ctx.db.insert("outreachPlans", {
        prospectId,
        workspaceId,
        userId,
        status: "draft",
        strategy: { rationale: "r", valueProposition: "v", tone: "peer" },
        version: 1,
        updatedAt: 1,
      });
      const taskId = await ctx.db.insert("outreachTasks", {
        planId,
        order: 1,
        type: "dm",
        description: "Say hi",
        status: "pending",
        timing: { type: "immediate" },
      });

      const tag = (kind: "prospect" | "plan" | "task", entityId: string) => ({
        id: `${kind}:${entityId}`,
        entityId,
        kind,
        label: kind,
        mentionText: kind,
        secondaryLabel: "",
        avatarUrl: null,
        verified: false,
      });
      const tags = [
        tag("prospect", String(prospectId)),
        tag("plan", String(planId)),
        tag("task", String(taskId)),
      ];
      const resolve = (
        scope: Parameters<typeof buildResolvedTaggedEntityLine>[1]
      ) =>
        Promise.all(
          tags.map((entity) =>
            buildResolvedTaggedEntityLine(
              ctx as unknown as ActionCtx,
              scope,
              entity
            )
          )
        );

      return {
        // A thread with no workspace, e.g. one from createChatThread.
        noWorkspace: await resolve({
          kind: "unknown",
          workspaceId: null,
          prospectId: null,
          userId: null,
        }),
        ownWorkspace: await resolve({
          kind: "workspace",
          workspaceId,
          prospectId: null,
          userId,
        }),
      };
    });

    expect(lines.noWorkspace).toEqual([null, null, null]);
    expect(lines.ownWorkspace[1]).toContain("Plan for Jane Roe");
    expect(lines.ownWorkspace[2]).toContain("Say hi");
  });
});
