import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "rollover plan usage cycles",
  { hours: 1 },
  internal.planUsage.rolloverStaleUsageCycles
);

export default crons;
