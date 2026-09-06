// convex/agents/tools/index.ts
// Barrel exports for agent tools

export { analyzeUrl } from "./analyzeUrl";
export {
  generateImprovedDescriptionAndICPs,
  generateImproved,
} from "./generateImprovedDescription";
export { getUserStatus } from "./getUserStatus";
export {
  approveSetupExamples,
  getSetupTargeting,
  reviseSetupAudience,
  submitSetupAudience,
} from "./setupSessionChat";
export { rememberWorkspaceMemory } from "./rememberWorkspaceMemory";
export { searchWorkspaceMemories } from "./searchWorkspaceMemories";
export { queryWorkspace } from "./queryWorkspace";
export {
  approveWorkspaceProfiles,
  proposeWorkspaceProfiles,
  rejectWorkspaceProfiles,
} from "./workspaceProfileChanges";

// Prospecting tools
export { convertToSocialQueries } from "./convertToSocialQueries";
export { searchProspects } from "./searchProspects";

// Qualification tools
export { qualifyProspect } from "./qualifyProspect";

// Enrichment tools
export { enrichProspect } from "./enrichProspect";

// Main △ Agent plan portfolio + unified batch tools
export { listProspectPlans, managePlanBatch } from "./planBatch";
