import type { ProspectProfileData } from "../ui/components/ProspectProfilePanel";
import type { PipelineStage } from "../ui/components/PipelineTimeline";
import type { PainPoint } from "../ui/components/PainSolutionGrid";
import type { SocialProfiles } from "../ui/components/SocialProfileLinks";

function getEvidencePostId(post: unknown): string | null {
  if (!post || typeof post !== "object") return null;

  const postRecord = post as Record<string, unknown>;

  if (typeof postRecord.id_str === "string" && postRecord.id_str.length > 0) {
    return postRecord.id_str;
  }

  if (typeof postRecord.postID === "string" && postRecord.postID.length > 0) {
    return postRecord.postID;
  }

  if (typeof postRecord.id === "string" && postRecord.id.length > 0) {
    return postRecord.id;
  }

  if (typeof postRecord.id === "number") {
    return String(postRecord.id);
  }

  if (typeof postRecord.urn === "string" && postRecord.urn.length > 0) {
    return postRecord.urn;
  }

  return null;
}

function normalizeEvidencePost(
  post: unknown,
  evidencePostsById: Map<string, unknown>
): unknown {
  if (!post || typeof post !== "object") return post;

  const postRecord = post as Record<string, unknown>;
  if (postRecord.raw && typeof postRecord.raw === "object") {
    return postRecord.raw;
  }

  const postId = getEvidencePostId(post);
  if (postId && evidencePostsById.has(postId)) {
    return evidencePostsById.get(postId) as unknown;
  }

  return post;
}

export function normalizeProspectProfileData(
  raw: unknown
): ProspectProfileData | null {
  if (!raw || typeof raw !== "object") return null;

  const prospect = raw as Record<string, unknown>;
  const data = prospect.data as Record<string, unknown> | undefined;
  const socialProfiles = prospect.socialProfiles as SocialProfiles | undefined;
  const rawEvidencePosts = Array.isArray(prospect.evidencePosts)
    ? (prospect.evidencePosts as unknown[])
    : [];
  const rawPainPoints = prospect.painPoints as PainPoint[] | undefined;
  const rawFinance = prospect.finance as
    | { displayValue: string; evidencePosts?: unknown[] }
    | undefined;

  const evidencePostsById = new Map<string, unknown>();
  for (const post of rawEvidencePosts) {
    const normalized = normalizeEvidencePost(post, new Map());
    const postId = getEvidencePostId(normalized);
    if (postId && !evidencePostsById.has(postId)) {
      evidencePostsById.set(postId, normalized);
    }
  }

  const resolveEvidencePost = (post: unknown): unknown =>
    normalizeEvidencePost(post, evidencePostsById);

  const painPoints = rawPainPoints?.map((painPoint) => ({
    ...painPoint,
    evidencePosts: Array.isArray(painPoint.evidencePosts)
      ? painPoint.evidencePosts.map(resolveEvidencePost)
      : [],
  }));

  const finance = rawFinance
    ? {
        displayValue: rawFinance.displayValue,
        evidencePosts: Array.isArray(rawFinance.evidencePosts)
          ? rawFinance.evidencePosts.map(resolveEvidencePost)
          : [],
      }
    : undefined;

  let avatarUrl: string | undefined;
  let profileUrl: string | undefined;
  let verified = false;

  if (prospect.platform === "twitter") {
    const user = data?.user as Record<string, unknown> | undefined;
    avatarUrl = (user?.profile_image_url_https as string) || undefined;
    verified = Boolean(user?.verified);
    profileUrl =
      (socialProfiles?.twitter?.url as string | undefined) ||
      (socialProfiles?.twitter?.username
        ? `https://x.com/${socialProfiles.twitter.username}`
        : undefined) ||
      (user?.screen_name ? `https://x.com/${user.screen_name}` : undefined);
  } else if (prospect.platform === "linkedin") {
    const author = data?.author as Record<string, unknown> | undefined;
    avatarUrl = (author?.profilePictureURL as string) || undefined;
    profileUrl =
      (socialProfiles?.linkedin?.url as string | undefined) ||
      (author?.url as string) ||
      undefined;
  }

  const creationTime =
    typeof prospect._creationTime === "number"
      ? (prospect._creationTime as number)
      : undefined;
  const existingStageTimestamps = prospect.stageTimestamps as
    | Partial<Record<PipelineStage, number>>
    | undefined;

  return {
    id:
      typeof prospect._id === "string"
        ? prospect._id
        : String(prospect._id ?? prospect.id ?? ""),
    displayName: (prospect.displayName as string) || "Unknown",
    verified,
    title: prospect.title as string | undefined,
    avatarUrl,
    profileUrl,
    platform: prospect.platform as "twitter" | "linkedin",
    prospectType:
      (prospect.prospectType as "individual" | "organization" | "unknown") ||
      "unknown",
    briefIntro: prospect.briefIntro as string | undefined,
    pipelineStage: (prospect.pipelineStage as PipelineStage) || "new",
    stageTimestamps: creationTime
      ? {
          new: creationTime,
          ...existingStageTimestamps,
        }
      : existingStageTimestamps,
    qualificationScore: prospect.qualificationScore as number | undefined,
    qualificationStatus: prospect.qualificationStatus as
      | "pending"
      | "qualified"
      | "disqualified"
      | undefined,
    status: prospect.status as
      | "new"
      | "contacted"
      | "in_progress"
      | "converted"
      | "archived",
    company: prospect.company as string | undefined,
    websiteUrl: prospect.websiteUrl as string | undefined,
    email: prospect.email as string | undefined,
    finance,
    location: prospect.location as string | undefined,
    painPoints,
    evidencePosts: rawEvidencePosts.map(resolveEvidencePost),
    socialProfiles,
    discoverySource: prospect.discoverySource as
      | "search_post"
      | "conversation_reply"
      | undefined,
    updatedAt:
      (prospect.updatedAt as number | undefined) ?? creationTime ?? undefined,
  };
}
