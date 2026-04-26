// convex/convex.config.ts
import { defineApp } from "convex/server";
import workflow from "@convex-dev/workflow/convex.config";
import agent from "@convex-dev/agent/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import rag from "@convex-dev/rag/convex.config";
import polar from "@convex-dev/polar/convex.config";

const app = defineApp();

// Register Convex components
app.use(workflow);
app.use(agent);
app.use(actionRetrier);
// Workpools for throttling (prevents OCC errors on rate limit table)
app.use(workpool, { name: "qualificationPool" });
app.use(workpool, { name: "enrichmentPool" });
app.use(workpool, { name: "previewQualificationPool" });
app.use(workpool, { name: "previewEnrichmentPool" });
app.use(workpool, { name: "outreachPlanPool" });
app.use(workpool, { name: "memoryEvaluationPool" });
// RAG for semantic search in outreach
app.use(rag);
// Polar for subscription payments
app.use(polar);

export default app;
