"use node";

import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getStringProperty, isRecord } from "./typeGuards";
import {
  resolveLinkedInProspectProfileIdentifiers,
  normalizeLinkedInProfileQueryUrn,
} from "../integrations/linkedin/profileIdentity";
import { getLearningTargetingFingerprint } from "./learningTargetingHelpers";
import {
  sanitizeLinkedInProfileForWorkflow,
  sanitizeWorkflowString,
} from "./workflowSafeProspect";

/** Bounded evidence acquisition for people-search seeds, before any fit verdict. */
export async function collectQualificationDiscoveryEvidence(
  ctx: ActionCtx,
  prospect: Doc<"prospects">
): Promise<{
  profileData: Record<string, unknown>;
  evidencePosts: Record<string, unknown>[];
} | null> {
  if (
    prospect.platform !== "linkedin" ||
    prospect.discoverySource !== "search_people"
  )
    return null;
  if (
    isRecord(prospect.qualificationProfileData) &&
    prospect.qualificationEvidenceFetchedAt
  ) {
    return {
      profileData: prospect.qualificationProfileData,
      evidencePosts: (prospect.evidencePosts ?? []).filter(isRecord),
    };
  }
  const identifiers = resolveLinkedInProspectProfileIdentifiers(prospect);
  if (!identifiers.username && !identifiers.profileUrn)
    throw new Error(
      "[QualificationEvidence] LinkedIn profile identity unavailable"
    );
  const workspace = await ctx.runQuery(internal.workspaces.getById, {
    workspaceId: prospect.workspaceId,
  });
  if (!workspace)
    throw new Error("[QualificationEvidence] Workspace no longer exists");
  const result = await ctx.runAction(
    internal.integrations.linkedin.getProfile.getProfile,
    {
      username: identifiers.username,
      urn: identifiers.profileUrn,
      includeContactInfo: false,
    }
  );
  if (!result.success || !isRecord(result.profile))
    throw new Error(
      `[QualificationEvidence] ${result.error ?? "Profile fetch failed"}`
    );
  const profile = result.profile;
  const sameUsername =
    identifiers.username &&
    profile.username?.toLowerCase() === identifiers.username.toLowerCase();
  const sameUrn =
    identifiers.profileUrn &&
    [profile.urn, String(profile.id)].some(
      (id) => normalizeLinkedInProfileQueryUrn(id) === identifiers.profileUrn
    );
  // A stable known identity takes precedence over a mutable/reused username.
  if (identifiers.profileUrn ? !sameUrn : !sameUsername)
    throw new Error(
      "[QualificationEvidence] Provider returned a different profile"
    );
  const profileData = {
    ...sanitizeLinkedInProfileForWorkflow(profile),
    // Retain actual responsibilities; the generic workflow sanitizer keeps only company names.
    position: (profile.position ?? []).slice(0, 5).map((position) => ({
      title: position.title ?? "",
      companyName: position.companyName ?? "",
      description: sanitizeWorkflowString(position.description ?? "").slice(
        0,
        4000
      ),
    })),
    url: `https://www.linkedin.com/in/${encodeURIComponent(profile.username || identifiers.username || profile.urn)}`,
  };
  const activity = await ctx.runAction(
    internal.integrations.linkedin.getProfilePosts.getProfilePostsInternal,
    {
      urn: profile.urn,
      maxPosts: 10,
    }
  );
  // Empty/private activity is a successful bounded lookup; network failures throw and retry.
  const evidencePosts = activity.posts.map((post) => ({
    ...post,
    id: post.urn,
    url: post.url ?? `https://www.linkedin.com/feed/update/${post.urn}`,
  }));
  await ctx.runMutation(
    internal.prospects.saveQualificationDiscoveryEvidenceInternal,
    {
      prospectId: prospect._id,
      workspaceId: prospect.workspaceId,
      expectedTargetingFingerprint: getLearningTargetingFingerprint(workspace),
      profileData,
      evidencePosts,
    }
  );
  return { profileData, evidencePosts };
}

/** Real provider profile text, not search snippets or synthetic persona data. */
export function getQualificationProfileText(
  profile: Record<string, unknown>
): string {
  const positions = Array.isArray(profile.position)
    ? profile.position.filter(isRecord).slice(0, 5)
    : [];
  return [
    getStringProperty(profile, "headline"),
    getStringProperty(profile, "summary"),
    ...positions.flatMap((position) => [
      getStringProperty(position, "title"),
      getStringProperty(position, "companyName"),
      getStringProperty(position, "description"),
    ]),
  ]
    .filter((text): text is string => Boolean(text?.trim()))
    .join("\n");
}
