/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import type { FunctionReturnType } from "convex/server";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { buildProspectSummaryRecord } from "./lib/readModelHelpers";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("feed and search rows say which prospects the user opened, past the first 50", async () => {
  const t = convexTest(schema, modules);
  const { workspaceId, prospectIds } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "opened-rows-user",
      email: "opened-rows@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      userId,
      name: "Opened rows",
      description: "Unread state",
      isDefault: true,
      updatedAt: 1,
    });
    const prospectIds: Id<"prospects">[] = [];
    for (let index = 0; index < 55; index += 1) {
      const prospectId = await ctx.db.insert("prospects", {
        workspaceId,
        userId,
        platform: "twitter",
        origin: "workspace_discovery",
        externalId: `opened-rows-${index}`,
        data: {},
        status: "new",
        displayName: `Prospect ${index}`,
        qualificationScore: 90,
        updatedAt: index,
      });
      const prospect = (await ctx.db.get(prospectId))!;
      await ctx.db.insert(
        "prospectSummaries",
        buildProspectSummaryRecord(prospect)
      );
      prospectIds.push(prospectId);
    }
    return { workspaceId, prospectIds };
  });

  const user = t.withIdentity({ subject: "opened-rows-user" });
  const openedId = prospectIds[52];
  await user.mutation(api.prospectListFeed.markProspectOpened, {
    prospectId: openedId,
  });

  const rows = [];
  let cursor: string | null = null;
  do {
    const result: FunctionReturnType<
      typeof api.prospectListFeed.listStableWorkspaceProspectSummaries
    > = await user.query(
      api.prospectListFeed.listStableWorkspaceProspectSummaries,
      {
        workspaceId,
        status: "new",
        visibilityMode: "all",
        paginationOpts: { numItems: 10, cursor },
      }
    );
    rows.push(...result.page);
    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor);

  expect(rows).toHaveLength(55);
  expect(rows.filter((row) => row.opened).map((row) => row.prospectId)).toEqual(
    [openedId]
  );

  const searchRows = await user.query(
    internal.prospectListFeed.getOpenedProspectSummariesInternal,
    { workspaceId, prospectIds: [prospectIds[0], openedId] }
  );
  expect(
    searchRows.filter((row) => row.opened).map((row) => row.prospectId)
  ).toEqual([openedId]);
});
