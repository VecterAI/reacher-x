import { internal } from "./_generated/api";
import { migrations } from "./migrations";
import { LEGACY_TESTER_SUBSCRIPTION_ID } from "./lib/planGrantCore";
import { refreshUserPlanFromBilling } from "./lib/planTransitionCore";

/** Run once after rollout. Known legacy grants keep their original expiry. */
export const migrateLegacyTesterPlans = migrations.define({
  table: "userPlans",
  batchSize: 10,
  migrateOne: async (ctx, plan) => {
    if (plan.externalSubscriptionId === LEGACY_TESTER_SUBSCRIPTION_ID) {
      await refreshUserPlanFromBilling(ctx, plan.userId);
    }
  },
});

export const run = migrations.runner([
  internal.planGrantMigration.migrateLegacyTesterPlans,
]);
