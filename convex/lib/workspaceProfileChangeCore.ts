import type { Doc } from "../_generated/dataModel";
import {
  canonicalizeWorkspaceProfileChannels,
  getWorkspaceProfileChannel,
  isSupportedWorkspaceProfileChannel,
} from "../../shared/lib/workspaceProfileChannels";
import { resolveWorkspaceProfileProvenance } from "../../shared/lib/workspaceProfileProvenance";

export type WorkspaceProfile = NonNullable<Doc<"workspaces">["icps"]>[number];
export type WorkspaceProfileProvenance = NonNullable<
  WorkspaceProfile["provenance"]
>;

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeList(values: string[]): string[] {
  return values
    .flatMap((value) => {
      const normalized = normalizeText(value);
      return normalized ? [normalized] : [];
    })
    .sort();
}

function normalizeTrimmedList(values: string[]): string[] {
  return values.flatMap((value) => {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  });
}

function getProfileTitleKey(profile: Pick<WorkspaceProfile, "title">): string {
  return normalizeText(profile.title);
}

function getProfileContentKey(
  profile: Pick<
    WorkspaceProfile,
    "title" | "description" | "painPoints" | "channels"
  >
): string {
  return JSON.stringify({
    title: getProfileTitleKey(profile),
    description: normalizeText(profile.description),
    painPoints: normalizeList(profile.painPoints),
    channels: canonicalizeWorkspaceProfileChannels(profile.channels),
  });
}

export function normalizeWorkspaceProfiles(
  profiles: WorkspaceProfile[]
): WorkspaceProfile[] {
  return profiles.map((profile) => ({
    title: profile.title.trim(),
    description: profile.description.trim(),
    painPoints: normalizeTrimmedList(profile.painPoints),
    channels: Array.from(
      new Set(
        normalizeTrimmedList(profile.channels).map(
          (channel) => getWorkspaceProfileChannel(channel) ?? channel
        )
      )
    ),
    ...(profile.provenance ? { provenance: profile.provenance } : {}),
    ...(profile.syntheticExamples
      ? { syntheticExamples: profile.syntheticExamples }
      : {}),
    ...(profile.syntheticPosts
      ? { syntheticPosts: profile.syntheticPosts }
      : {}),
    ...(profile.qualificationKeywords
      ? { qualificationKeywords: profile.qualificationKeywords }
      : {}),
  }));
}

export function getWorkspaceProfileProvenance(
  profile: WorkspaceProfile
): WorkspaceProfileProvenance {
  return resolveWorkspaceProfileProvenance(profile);
}

export function markWorkspaceProfilesAsAiGenerated(
  profiles: WorkspaceProfile[]
): WorkspaceProfile[] {
  return profiles.map((profile) => ({
    ...profile,
    provenance: "ai_generated" as const,
  }));
}

export function validateWorkspaceProfiles(profiles: WorkspaceProfile[]): void {
  if (profiles.length < 1) {
    throw new Error("At least one ideal profile is required.");
  }

  const titleKeys = new Set<string>();
  for (const profile of profiles) {
    const titleKey = getProfileTitleKey(profile);
    if (!titleKey) {
      throw new Error("Every ideal profile requires a name.");
    }
    if (titleKeys.has(titleKey)) {
      throw new Error("Ideal profile names must be unique.");
    }
    if (
      profile.channels.some(
        (channel) => !isSupportedWorkspaceProfileChannel(channel)
      )
    ) {
      throw new Error("Ideal profile channels must use X/Twitter or LinkedIn.");
    }
    titleKeys.add(titleKey);
  }
}

export function describeWorkspaceProfileChanges(args: {
  currentProfiles: WorkspaceProfile[];
  proposedProfiles: WorkspaceProfile[];
}): {
  addedTitles: string[];
  updatedTitles: string[];
  removedTitles: string[];
} {
  const currentByTitle = new Map(
    args.currentProfiles.map((profile) => [
      getProfileTitleKey(profile),
      profile,
    ])
  );
  const proposedByTitle = new Map(
    args.proposedProfiles.map((profile) => [
      getProfileTitleKey(profile),
      profile,
    ])
  );

  const addedTitles: string[] = [];
  const updatedTitles: string[] = [];
  const removedTitles: string[] = [];

  for (const profile of args.proposedProfiles) {
    const current = currentByTitle.get(getProfileTitleKey(profile));
    if (!current) {
      addedTitles.push(profile.title);
      continue;
    }
    if (getProfileContentKey(current) !== getProfileContentKey(profile)) {
      updatedTitles.push(profile.title);
    }
  }

  for (const profile of args.currentProfiles) {
    if (!proposedByTitle.has(getProfileTitleKey(profile))) {
      removedTitles.push(profile.title);
    }
  }

  return { addedTitles, updatedTitles, removedTitles };
}
