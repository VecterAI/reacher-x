export type WorkspaceProfileProvenance = "ai_generated" | "manual";

export const AGENT_GENERATED_PROFILE_LABEL = "△ Agent generated";

export function resolveWorkspaceProfileProvenance(profile: {
  provenance?: WorkspaceProfileProvenance;
  qualificationKeywords?: string[];
  syntheticPosts?: string[];
}): WorkspaceProfileProvenance {
  if (profile.provenance) {
    return profile.provenance;
  }

  return profile.syntheticPosts?.length || profile.qualificationKeywords?.length
    ? "ai_generated"
    : "manual";
}
