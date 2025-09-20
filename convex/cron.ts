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

export default crons;
