import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "@/convex/_generated/api";
import { BLOG_DEMO_IDS } from "@/features/blog/lib/blogDemoHelpers";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { parseUsageCycleKey } from "@/convex/lib/usageDashboardCore";
import { createAppServices } from "./appServices";

test("every demo has consistent usage, billing, and populated history pages", async () => {
  for (const scenario of BLOG_DEMO_IDS) {
    const { client, state } = createAppServices(scenario);
    assert.equal(
      new Set(state.prospects.map((person) => person.displayName)).size,
      state.prospects.length
    );
    const plan = await client.query(api.plans.getCurrentPlan, {});
    const subscription = await client.query(api.polar.getSubscription, {});
    const usage = await client.query(api.usage.getUsageDashboard, {
      nowMs: getCurrentUTCTimestamp(),
    });
    assert.ok(usage && plan && subscription);
    assert.equal(usage.summary.plan.tier, plan.tier);
    assert.equal(plan.polarCustomerId, subscription.customerId);
    assert.equal(usage.summary.workspacesUsed, state.workspaces.length);
    const invoices = await client.action(api.billing.listSubscriptionHistory, {
      page: 1,
      limit: 5,
    });
    assert.equal(invoices.rows.length, 3);
    assert.equal(invoices.rows[0].totalAmount, subscription.amount);
    for (const cycle of usage.cycleOptions) {
      const selected = await client.query(api.usage.getUsageDashboard, {
        selectedCycleKey: cycle.key,
        nowMs: getCurrentUTCTimestamp(),
      });
      const window = parseUsageCycleKey(cycle.key)!;
      assert.ok(selected);
      for (const row of selected.workspaces) {
        const expected = state.prospects.filter(
          (person) =>
            person.workspaceId === row.workspaceId &&
            person.qualificationStatus === "qualified" &&
            person.qualifiedAt! >= window.cycleStart &&
            person.qualifiedAt! < window.cycleEnd
        ).length;
        assert.equal(row.used, expected);
        assert.ok(row.used > 0, `${scenario}: ${cycle.label}: ${row.name}`);
        assert.equal(
          row.trend.reduce((sum, point) => sum + point.value, 0),
          row.used
        );
        assert.equal(
          selected.comparison.rows.find(
            (item) => item.workspaceId === row.workspaceId
          )?.used,
          row.used
        );
      }
    }
    for (const workspace of state.workspaces) {
      for (const status of ["converted", "archived"] as const) {
        const rows = await client.query(
          api.prospectSummaries.listWorkspaceProspectSummaries,
          {
            workspaceId: workspace._id,
            status,
            paginationOpts: { cursor: null, numItems: 10 },
          }
        );
        assert.ok(rows.page.length > 0, `${scenario}: ${status}`);
        assert.ok(
          rows.page.every(
            (row) => row.workspaceId === workspace._id && row.status === status
          )
        );
      }
    }
  }
});

test("notification actions update the shell count and stay within their workspace", async () => {
  const { client, state } = createAppServices("find-investors");
  const workspaceId = state.selectedWorkspaceId;
  const rows = await client.query(api.outreach.listNotifications, {
    workspaceId,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  assert.equal(rows.page.length, 1);
  const notificationId = rows.page[0]._id;
  assert.equal(
    (await client.query(api.shell.getAppShellState, {}))
      ?.pendingNotificationCount,
    1
  );
  await assert.rejects(
    client.mutation(api.outreach.dismissNotification, {
      notificationId,
      workspaceId: state.workspaces[1]._id,
    }),
    /workspace/
  );
  await client.mutation(api.outreach.markNotificationSeen, {
    notificationId,
    workspaceId,
  });
  assert.equal(
    (await client.query(api.shell.getAppShellState, {}))
      ?.pendingNotificationCount,
    0
  );
  await client.mutation(api.outreach.dismissNotification, {
    notificationId,
    workspaceId,
  });
  assert.equal(
    (
      await client.query(api.outreach.listNotifications, {
        workspaceId,
        paginationOpts: { cursor: null, numItems: 20 },
      })
    ).page.length,
    0
  );
});
