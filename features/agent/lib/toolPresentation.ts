export type ToolPresentationInput = Record<string, unknown> | undefined;

export type ToolIconKey =
  | "account"
  | "attachment"
  | "brain"
  | "check"
  | "change"
  | "cognition"
  | "delete"
  | "document"
  | "draft"
  | "edit"
  | "factCheck"
  | "folder"
  | "forum"
  | "framePerson"
  | "globe"
  | "group"
  | "link"
  | "linkedin"
  | "pause"
  | "person"
  | "refresh"
  | "search"
  | "searchActivity"
  | "settings"
  | "swap"
  | "twitter";

const TOOL_LABELS: Record<string, string> = {
  analyzeUrl: "Analyze website",
  approveSetupExamples: "Approve examples",
  approveSocialActionRequest: "Approve social action",
  approveTask: "Approve task",
  approveWorkspaceProfiles: "Approve profiles",
  askHuman: "Request input",
  cancelPlan: "Cancel plan",
  convertToSocialQueries: "Prepare searches",
  createWorkspace: "Create workspace",
  deletePlan: "Delete plan",
  displayEntity: "Show details",
  enrichProspect: "Find details",
  generateImprovedDescriptionAndICPs: "Define audience",
  generatePlan: "Create outreach plan",
  generateSeedKeywords: "Generate keywords",
  getProspectInteractionHistory: "Read conversation history",
  getProspectPlan: "Read outreach plan",
  getSetupTargeting: "Read targeting",
  getSocialContext: "Read recent posts",
  getUserStatus: "Check account",
  inspectWorkspace: "Inspect workspace",
  listProspectPlans: "List outreach plans",
  managePlanBatch: "Manage outreach plans",
  pausePlan: "Pause plan",
  proposeWorkspaceProfiles: "Propose profiles",
  qualifyProspect: "Check match",
  queryWorkspace: "Check workspace",
  rememberWorkspaceMemory: "Save workspace memory",
  rejectWorkspaceProfiles: "Reject profiles",
  refinePlan: "Refine plan",
  researchProspect: "Research profile",
  resumePlan: "Resume plan",
  reviseSetupAudience: "Revise audience",
  searchProspects: "Find matches",
  searchWorkspaceMemories: "Search workspace memory",
  socialAction: "Take social action",
  startWorkspacePlans: "Start outreach plans",
  submitSetupAudience: "Set up audience",
  updateWorkspace: "Update workspace",
  webResearch: "Search the web",
  workspaceAttachments: "Check attachments",
};

const TOOL_ICON_KEYS: Record<string, ToolIconKey> = {
  analyzeUrl: "link",
  approveSetupExamples: "check",
  approveSocialActionRequest: "check",
  approveTask: "check",
  approveWorkspaceProfiles: "check",
  askHuman: "person",
  cancelPlan: "delete",
  convertToSocialQueries: "swap",
  createWorkspace: "folder",
  deletePlan: "delete",
  displayEntity: "person",
  enrichProspect: "searchActivity",
  generateImprovedDescriptionAndICPs: "group",
  generatePlan: "draft",
  generateSeedKeywords: "search",
  getProspectInteractionHistory: "forum",
  getProspectPlan: "document",
  getSetupTargeting: "factCheck",
  getUserStatus: "account",
  inspectWorkspace: "folder",
  listProspectPlans: "document",
  managePlanBatch: "document",
  pausePlan: "pause",
  proposeWorkspaceProfiles: "framePerson",
  qualifyProspect: "factCheck",
  queryWorkspace: "folder",
  rememberWorkspaceMemory: "cognition",
  rejectWorkspaceProfiles: "delete",
  refinePlan: "edit",
  researchProspect: "framePerson",
  resumePlan: "refresh",
  reviseSetupAudience: "settings",
  searchProspects: "search",
  searchWorkspaceMemories: "brain",
  socialAction: "change",
  startWorkspacePlans: "check",
  submitSetupAudience: "settings",
  updateWorkspace: "folder",
  webResearch: "globe",
  workspaceAttachments: "attachment",
};

function humanizeToolName(toolName: string): string {
  const words = toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();

  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Working";
}

export function getToolLabel(
  toolName: string,
  input?: ToolPresentationInput
): string {
  if (toolName === "webResearch") {
    if (input?.operation === "read") return "Read web page";
  }

  return TOOL_LABELS[toolName] ?? humanizeToolName(toolName);
}

/** Inline source artifacts render as the source itself, without a label row. */
export function isInlineWebResearchCall(
  toolName: string,
  input?: ToolPresentationInput
): boolean {
  return toolName === "webResearch" && input?.operation === "show";
}

export function getToolIconKey(
  toolName: string,
  input?: ToolPresentationInput
): ToolIconKey {
  // getSocialContext is platform-aware: explicit platforms render as platform
  // icons, and auto/unknown falls back to the generic change-history icon.
  if (toolName === "getSocialContext") {
    if (input?.platform === "twitter") return "twitter";
    if (input?.platform === "linkedin") return "linkedin";
    return "change";
  }

  return TOOL_ICON_KEYS[toolName] ?? "change";
}

export const toolPresentation = {
  labels: TOOL_LABELS,
  iconKeys: TOOL_ICON_KEYS,
} as const;
