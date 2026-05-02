// convex/agents/outreach/tools/index.ts
// Barrel exports for outreach agent tools

export { getSocialContext } from "./getSocialContext";
export { getProspectPlan } from "./getProspectPlan";
export { generatePlan } from "./generatePlan";
export { refinePlan } from "./refinePlan";
export { displayEntity } from "./displayEntity";
export { askHuman } from "./askHuman";
export { approveTask } from "./approveTask";
export { approveSocialActionRequest } from "./approveSocialActionRequest";
export { socialAction } from "./socialAction";

// Shared helpers (for use in other modules if needed)
export {
  extractProspectIdFromThread,
  extractProspectIdWithFallback,
  extractPlanIdFromThread,
  type ToolContext,
} from "./helpers";
export {
  resolveSocialContext,
  type SocialContextMode,
  type SocialDisplayEntity,
  type SocialContextPlatform,
  type SocialContextSelection,
} from "./socialContextShared";

// Shared workspace memory tools (defined in the main agents/tools folder)
export { rememberWorkspaceMemory } from "../../tools/rememberWorkspaceMemory";
export { searchWorkspaceMemories } from "../../tools/searchWorkspaceMemories";
