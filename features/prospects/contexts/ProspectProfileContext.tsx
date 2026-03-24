/**
 * ProspectProfileContext
 * Manages prospect profile data loading and panel state.
 * Wraps PanelStackContext with data fetching capabilities.
 */
"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useActiveUseCaseLabels, useQueryWithStatus } from "@/shared/hooks";
import {
  type OpenReplyPanelParams,
  ReplyPanelProvider,
} from "@/shared/contexts/ReplyPanelContext";
import { PanelStackProvider, usePanelStack } from "./PanelStackContext";
import type { ProspectProfileData } from "../ui/components/ProspectProfilePanel";
import type { PipelineStage } from "../ui/components/PipelineTimeline";
import type { PainPoint } from "../ui/components/PainSolutionGrid";
import type { SocialProfiles } from "../ui/components/SocialProfileLinks";

interface ProspectProfileContextValue {
  /** Currently selected prospect ID */
  prospectId: Id<"prospects"> | null;
  /** Prospect data (loaded from Convex) */
  prospect: ProspectProfileData | null;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Open prospect profile panel */
  openProspect: (prospectId: Id<"prospects">) => void;
  /** Close the profile panel */
  closeProspect: () => void;
}

const ProspectProfileContext = React.createContext<
  ProspectProfileContextValue | undefined
>(undefined);

export function useProspectProfile() {
  const context = React.useContext(ProspectProfileContext);
  if (!context) {
    throw new Error(
      "useProspectProfile must be used within a ProspectProfileProvider"
    );
  }
  return context;
}

/**
 * Transform raw Convex prospect data to ProspectProfileData format
 */
function transformProspectData(raw: unknown): ProspectProfileData | null {
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
    const postId = getEvidencePostId(post);
    if (postId && !evidencePostsById.has(postId)) {
      evidencePostsById.set(postId, post);
    }
  }

  const resolveEvidencePost = (post: unknown): unknown => {
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
  };

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

  // Extract avatar from platform data
  let avatarUrl: string | undefined;
  let profileUrl: string | undefined;
  let verified = false;

  if (prospect.platform === "twitter" && data) {
    const user = data.user as Record<string, unknown> | undefined;
    avatarUrl = (user?.profile_image_url_https as string) || undefined;
    verified = Boolean(user?.verified);
    profileUrl = user?.screen_name
      ? `https://x.com/${user.screen_name}`
      : undefined;
  } else if (prospect.platform === "linkedin" && data) {
    const author = data.author as Record<string, unknown> | undefined;
    avatarUrl = (author?.profilePictureURL as string) || undefined;
    profileUrl = (author?.url as string) || undefined;
  }

  return {
    id: prospect._id as string,
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
    // Build stageTimestamps: use _creationTime for "new" stage, DB values for others
    stageTimestamps: {
      new: prospect._creationTime as number,
      ...(prospect.stageTimestamps as Partial<Record<PipelineStage, number>>),
    },
    qualificationScore: prospect.qualificationScore as number | undefined,
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
    evidencePosts: rawEvidencePosts,
    socialProfiles,
    updatedAt: prospect._creationTime as number | undefined,
  };
}

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

function ProspectProfileProviderInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { entitySingular } = useActiveUseCaseLabels();
  const entitySingularLower = entitySingular.toLowerCase();
  const { pushPanel, clearStack, depth } = usePanelStack();
  const markProspectOpenedMutation = useMutation(
    api.prospectListFeed.markProspectOpened
  );
  const [prospectId, setProspectId] = React.useState<Id<"prospects"> | null>(
    null
  );

  // Fetch prospect data when we have an ID
  const rawProspectQuery = useQueryWithStatus(
    api.prospects.getProspect,
    prospectId ? { prospectId } : "skip"
  );
  const rawProspect = rawProspectQuery.data;

  const loading = prospectId !== null && rawProspectQuery.isPending;
  const error = rawProspectQuery.isError
    ? rawProspectQuery.error.message || `Failed to load ${entitySingularLower}`
    : rawProspect === null
      ? `${entitySingular} not found`
      : null;
  const prospect = rawProspect ? transformProspectData(rawProspect) : null;

  const openProspect = React.useCallback(
    (id: Id<"prospects">) => {
      setProspectId(id);
      pushPanel("prospect-profile", { prospectId: id });
      void markProspectOpenedMutation({ prospectId: id });
    },
    [markProspectOpenedMutation, pushPanel]
  );

  const closeProspect = React.useCallback(() => {
    clearStack();
    setProspectId(null);
  }, [clearStack]);

  // Clear prospect ID when stack is empty
  React.useEffect(() => {
    if (depth === 0 && prospectId !== null) {
      setProspectId(null);
    }
  }, [depth, prospectId]);

  const value = React.useMemo(
    () => ({
      prospectId,
      prospect,
      loading,
      error,
      openProspect,
      closeProspect,
    }),
    [prospectId, prospect, loading, error, openProspect, closeProspect]
  );

  return (
    <ProspectProfileContext.Provider value={value}>
      {children}
    </ProspectProfileContext.Provider>
  );
}

function ReplyPanelProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { replacePanel } = usePanelStack();
  const openReplyPanel = React.useCallback(
    (params: OpenReplyPanelParams) => {
      replacePanel(
        "post-compose",
        params as unknown as Record<string, unknown>
      );
    },
    [replacePanel]
  );
  return (
    <ReplyPanelProvider value={openReplyPanel}>{children}</ReplyPanelProvider>
  );
}

/**
 * Provider that combines PanelStack + ProspectProfile contexts
 */
export function ProspectProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PanelStackProvider>
      <ReplyPanelProviderWrapper>
        <ProspectProfileProviderInner>{children}</ProspectProfileProviderInner>
      </ReplyPanelProviderWrapper>
    </PanelStackProvider>
  );
}
