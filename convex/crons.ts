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

export default crons;
