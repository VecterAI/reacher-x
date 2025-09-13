import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Note: WorkOS event processing is now handled via webhooks
// The cron job is disabled to prevent duplicate processing
// Uncomment the following lines if you need fallback polling:
/*
crons.interval(
  "process workos events",
  { minutes: 5 },
  api.workosActions.fetchWorkOSEvents,
  { limit: 50 } // Process up to 50 events at a time
);
*/

export default crons;
