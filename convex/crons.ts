import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "rollover plan usage cycles",
  { hours: 1 },
  internal.planUsage.rolloverStaleUsageCycles
);

crons.interval(
  "pause inactive workspaces",
  { hours: 1 },
  internal.workspaces.pauseInactiveWorkspaces
);

crons.interval(
  "retry failed automatic plans after provider recovery",
  { minutes: 2 },
  internal.workflows.autoPlanRecovery.retryFailedAutoPlansCron
);

crons.interval(
  "retire obsolete discovery monitors",
  { hours: 1 },
  internal.socialapiMonitors.retireDiscoveryMonitorsCron
);

crons.interval(
  "delete expired SocialAPI webhook receipts",
  { hours: 1 },
  internal.socialApiWebhookReceipts.cleanupExpiredCron
);

crons.interval(
  "remove legacy duplicate prospect RAG entries",
  { hours: 1 },
  internal.ragMaintenance.cleanupLegacyProspectRagCron
);

crons.interval(
  "retry failed workspace memory embeddings",
  { minutes: 2 },
  internal.memory.retryFailedCanonicalWorkspaceMemoryIndexesCron
);

crons.interval(
  "reconcile X/Twitter DM activity subscriptions",
  { minutes: 15 },
  internal.xActivity.retryDmActivitySubscriptionsCron,
  {}
);

crons.interval(
  "repair tenant scheduler lane indexes",
  { minutes: 1 },
  internal.tenantScheduler.reconcileQueuedLanesInternal
);

crons.interval(
  "reconcile tenant scheduler pool mode",
  { minutes: 5 },
  internal.tenantScheduler.reconcilePoolConfigurationInternal
);

crons.interval(
  "recover stale setup workflows",
  { minutes: 5 },
  internal.setupSessions.recoverStaleSetupWorkflowsInternal
);

crons.interval(
  "recover expired tenant scheduler leases",
  { minutes: 10 },
  internal.tenantScheduler.reapExpiredJobsInternal
);

crons.interval(
  "delete expired tenant scheduler history",
  { hours: 1 },
  internal.tenantScheduler.cleanupCompletedJobsInternal
);

export default crons;
