import type { Doc } from "@/convex/_generated/dataModel";
import type { ProspectProfileData } from "@/features/prospects";

export type SetupPreviewProspectRecord = Doc<"prospects">;

export function buildSetupPreviewProfileData(
  preview: SetupPreviewProspectRecord
): ProspectProfileData {
  const twitterUrl = preview.socialProfiles?.twitter?.username
    ? `https://x.com/${preview.socialProfiles.twitter.username}`
    : null;
  const linkedInUrl = preview.socialProfiles?.linkedin?.url;

  return {
    id: String(preview._id),
    displayName: preview.displayName ?? undefined,
    verified: preview.data?.user?.verified === true,
    title: preview.title ?? undefined,
    avatarUrl: preview.data?.user?.profile_image_url_https ?? undefined,
    profileUrl:
      preview.socialProfiles?.twitter?.url ??
      preview.socialProfiles?.linkedin?.url ??
      (preview.platform === "twitter" ? (twitterUrl ?? undefined) : undefined),
    platform: preview.platform,
    prospectType: preview.prospectType ?? "unknown",
    briefIntro: preview.briefIntro ?? undefined,
    qualificationScore: preview.qualificationScore ?? undefined,
    status: preview.status,
    pipelineStage: preview.pipelineStage,
    stageTimestamps: preview.stageTimestamps,
    company: preview.company ?? undefined,
    websiteUrl: preview.websiteUrl ?? undefined,
    email: preview.email ?? undefined,
    finance: preview.finance
      ? {
          displayValue: preview.finance.displayValue,
          evidencePosts: preview.finance.evidencePosts,
        }
      : undefined,
    location: preview.location ?? undefined,
    evidencePosts: preview.evidencePosts,
    painPoints: preview.painPoints?.map((painPoint) => ({
      pain: painPoint.pain,
      solution: painPoint.solution,
      evidencePosts: painPoint.evidencePosts,
    })),
    socialProfiles: {
      twitter: preview.socialProfiles?.twitter
        ? {
            username: preview.socialProfiles.twitter.username,
            url: preview.socialProfiles.twitter.url,
          }
        : undefined,
      linkedin:
        preview.socialProfiles?.linkedin && linkedInUrl
          ? {
              username: preview.socialProfiles.linkedin.username,
              url: linkedInUrl,
            }
          : undefined,
    },
    updatedAt: preview.updatedAt,
  };
}
