// convex/convex.config.ts
import { defineApp } from "convex/server";
import workflow from "@convex-dev/workflow/convex.config";
import agent from "@convex-dev/agent/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import rag from "@convex-dev/rag/convex.config";

const app = defineApp();

// Register Convex components
app.use(workflow);
app.use(agent);
app.use(actionRetrier);
// Workpools for throttling (prevents OCC errors on rate limit table)
app.use(workpool, { name: "qualificationPool" });
app.use(workpool, { name: "enrichmentPool" });
app.use(workpool, { name: "outreachPlanPool" });
// RAG for semantic search in outreach
app.use(rag);

export default app;
