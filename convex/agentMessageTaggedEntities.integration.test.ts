/// <reference types="vite/client" />

import agentTest from "@convex-dev/agent/test";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { buildAgentComposerSubmission } from "../features/agent/lib/buildAgentComposerMessage";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

vi.stubEnv("OPENROUTER_API_KEY", "tagged-entity-validator-test-key");
vi.stubEnv("OPENAI_API_KEY", "tagged-entity-validator-test-key");

describe("Agent message tagged entities", () => {
  test("creates a prospect thread with every supported tagged entity kind", async () => {
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
});
