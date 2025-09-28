import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Process any stuck replies every 5 minutes
crons.interval(
  "process stuck replies",
  { minutes: 5 },
  api.replyQueue.processStuckReplies
);

// Clean up old completed replies every hour
crons.interval(
  "cleanup reply queue",
  { hours: 1 },
  api.replyQueue.cleanupOldReplies
);

// Proactively refresh expiring X tokens every 5 minutes
crons.interval(
  "refresh expiring x tokens",
  { minutes: 5 },
  api.socialAccounts.refreshExpiringTokens
);

export default crons;
