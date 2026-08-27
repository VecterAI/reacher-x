/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { sanitizeWorkflowValue } from "./lib/workflowSafeProspect";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("prospect workflow serialization", () => {
  test("keeps the complete workflow payload free of unpaired surrogates", async () => {
    const t = convexTest(schema, modules);
    const boundaryText = `${"a".repeat(278)}\ud835\ude01tail`;

    const prospectId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        workosUserId: "workflow-unicode-user",
        email: "workflow-unicode@example.com",
      });
      const workspaceId = await ctx.db.insert("workspaces", {
        userId,
        name: "Workflow Unicode",
        description: "Unicode serialization regression coverage",
        isDefault: true,
        entitlementSlot: 1,
        updatedAt: 1,
      });

      return await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: "unicode-boundary-prospect",
        data: {},
        displayName: "Malformed display name\ud800",
        matchedKeywords: ["malformed keyword\udc00"],
        evidencePosts: [
          {
            id_str: "unicode-boundary-post",
            full_text: boundaryText,
            user: {
              id_str: "unicode-author",
              name: "Malformed author\ud800",
            },
            entities: {
              media: [
                {
                  type: "photo",
                  media_url_https: "https://example.com/image.png",
                  ext_alt_text: "Malformed alt text\udc00",
                },
              ],
            },
          },
        ],
        status: "new",
        qualificationStatus: "pending",
        updatedAt: 1,
      });
    });

    const result = await t.query(
      internal.prospects.getProspectWorkflowDataInternal,
      { prospectId }
    );
    const [post] = result?.evidencePosts ?? [];

    expect(result?.displayName).toBe("Malformed display name�");
    expect(result?.matchedKeywords).toEqual(["malformed keyword�"]);
    expect(post?.textPreview).toBe(`${"a".repeat(278)}…`);
    expect((post?.author as { name?: string })?.name).toBe("Malformed author�");
    expect(
      (post?.media as Array<{ altText?: string }> | undefined)?.[0]?.altText
    ).toBe("Malformed alt text�");
    expect(sanitizeWorkflowValue(result)).toEqual(result);
  });
});
