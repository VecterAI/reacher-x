// convex/agents/outreach/tools/index.ts
// Barrel exports for outreach agent tools

export { getProspectContext } from "./getProspectContext";
export { getProspectPlan } from "./getProspectPlan";
export { generatePlan } from "./generatePlan";
export { refinePlan } from "./refinePlan";
export { analyzeBestEngagement } from "./analyzeBestEngagement";
export { askHuman } from "./askHuman";
export { approveTask } from "./approveTask";
export { approveTwitterActionRequest } from "./approveTwitterActionRequest";
export { displayPost } from "./displayPost";
export { likePost } from "./likePost";
export { twitterAction } from "./twitterAction";

// Shared helpers (for use in other modules if needed)
export {
  extractProspectIdFromThread,
  extractProspectIdWithFallback,
  extractPlanIdFromThread,
  type ToolContext,
} from "./helpers";

// Shared workspace memory tools (defined in the main agents/tools folder)
export { rememberWorkspaceMemory } from "../../tools/rememberWorkspaceMemory";
export { searchWorkspaceMemories } from "../../tools/searchWorkspaceMemories";
