"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useOptionalPanelStack } from "@/features/prospects/contexts/PanelStackContext";
import { PageContent } from "@/features/webapp/ui/components/page/PageContent";
import { PageHeader } from "@/features/webapp/ui/components/page/PageHeader";
import { PageLayout } from "@/features/webapp/ui/components/page/PageLayout";
import {
  LinkedInPostCard,
  LinkedInPostCardSkeleton,
} from "@/features/webapp/ui/components/linkedin";
import { OpenGraphPreview } from "@/features/composer/ui/components/OpenGraphPreview";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import { Drawer, DrawerContent } from "@/shared/ui/components/Drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/components/Tabs";
import {
  AlternateEmailIcon,
  CheckCircleIcon,
  LinkIcon,
  MailIcon,
  MoreHorizIcon,
  NewReleasesIcon,
  OpenInNewIcon,
} from "@/shared/ui/components/icons";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import type { LinkedInProfileData } from "@/shared/lib/linkedin/profile";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import {
  base64UrlEncodeUtf8,
  cn,
  formatLargeNumber,
  getCurrentUTCTimestamp,
} from "@/shared/lib/utils";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { useLinkedInPostEngagementMerge } from "@/shared/hooks/useLinkedInPostEngagementMerge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPositionDuration(
  start?: { year: number; month?: number },
  end?: { year: number; month?: number }
): string {
  if (!start) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const startStr = start.month
    ? `${months[(start.month - 1) % 12]} ${start.year}`
    : `${start.year}`;
  if (!end) return `${startStr} - Present`;
  const endStr = end.month
    ? `${months[(end.month - 1) % 12]} ${end.year}`
    : `${end.year}`;
  return `${startStr} - ${endStr}`;
}

function formatProficiency(proficiency: string): string {
  const map: Record<string, string> = {
    NATIVE_OR_BILINGUAL: "Native or bilingual",
    FULL_PROFESSIONAL: "Full professional",
    PROFESSIONAL_WORKING: "Professional working",
    LIMITED_WORKING: "Limited working",
    ELEMENTARY: "Elementary",
  };
  return map[proficiency] || proficiency.replace(/_/g, " ").toLowerCase();
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function normalizeLinkedInDisplayText(text?: string): string {
  if (typeof text !== "string") {
    return "";
  }

  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .trim();
}

function getAnimatedParts(value: number): {
  value: number;
  suffix?: string;
  decimals: number;
} {
  const formatted = formatLargeNumber(value);
  const match = /^(\d+(?:\.\d+)?)([A-Za-z]*)$/.exec(formatted);
  if (!match) return { value, decimals: 0 };
  return {
    value: Number(match[1]),
    suffix: match[2] || undefined,
    decimals: /\.\d/.test(match[1]) ? 1 : 0,
  };
}

function dedupeLinkedInPosts(posts: UnifiedPost[]): UnifiedPost[] {
  const seen = new Set<string>();
  return posts.filter((post) => {
    const id = typeof post?.id === "string" ? post.id : "";
    if (!id) {
      return true;
    }
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

type PositionItem = LinkedInProfileData["positions"][number];

interface CompanyGroup {
  companyName: string;
  companyLogo?: string;
  positions: PositionItem[];
}

/** Group consecutive positions by companyId (or companyName as fallback) */
function groupPositionsByCompany(positions: PositionItem[]): CompanyGroup[] {
  const groups: CompanyGroup[] = [];
  for (const pos of positions) {
    const key = pos.companyId || pos.companyName;
    const last = groups[groups.length - 1];
    if (
      last &&
      (last.positions[0].companyId || last.positions[0].companyName) === key
    ) {
      last.positions.push(pos);
    } else {
      groups.push({
        companyName: pos.companyName,
        companyLogo: pos.companyLogo,
        positions: [pos],
      });
    }
  }
  return groups;
}

/** Dot separator matching the Twitter profile panel style */
function Dot() {
  return (
    <span aria-hidden className="px-0.5">
      ·
    </span>
  );
}

function ExpandableTextBlock({
  text,
  className,
  textClassName,
}: {
  text?: string;
  className?: string;
  textClassName?: string;
}) {
  const content = normalizeLinkedInDisplayText(text);
  const [expanded, setExpanded] = React.useState(false);
  const [overflowing, setOverflowing] = React.useState(false);
  const textRef = React.useRef<HTMLParagraphElement | null>(null);

  React.useEffect(() => {
    if (!content || expanded) {
      return;
    }

    const node = textRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const currentNode = textRef.current;
      if (!currentNode) {
        return;
      }
      setOverflowing(currentNode.scrollHeight > currentNode.clientHeight + 1);
    };

    measure();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;
    resizeObserver?.observe(node);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [content, expanded]);

  if (!content) {
    return null;
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p
        ref={textRef}
        className={cn(
          "text-foreground [&_a]:text-muted-foreground text-sm break-words whitespace-pre-line [&_a]:hover:underline",
          !expanded && "line-clamp-3",
          textClassName
        )}
      >
        {content}
      </p>
      {overflowing ? (
        <Button
          variant="outline"
          size="xs"
          className="w-fit"
          onClick={() => setExpanded((previous) => !previous)}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </div>
  );
}

const LINKEDIN_PROFILE_LOADING_SKELETON = (
  <>
    <div className="border-b pb-4">
      <div className="bg-muted h-44 w-full border-b opacity-50" />
      <div className="mx-4 -mt-7 space-y-4">
        <Skeleton className="ring-border h-12 w-12 rounded-full ring-1" />
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </div>
    </div>
    <div className="divide-y">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`post-skeleton-${index}`}
          className={cn("px-4 pb-2", index === 0 ? "pt-4" : "pt-2")}
        >
          <LinkedInPostCardSkeleton />
        </div>
      ))}
    </div>
  </>
);

const LINKEDIN_PROFILE_CACHE_TTL_MS = 30_000;
const LINKEDIN_RELATIONSHIP_CHECK_TIMEOUT_MS = 8_000;

type LinkedInProfileCacheEntry = {
  profile: LinkedInProfileData;
  fetchedAt: number;
};

const linkedInProfileCache = new Map<string, LinkedInProfileCacheEntry>();
const linkedInProfileInflight = new Map<
  string,
  Promise<LinkedInProfileData | null>
>();

function isFreshLinkedInProfileCache(timestamp?: number) {
  return (
    typeof timestamp === "number" &&
    getCurrentUTCTimestamp() - timestamp < LINKEDIN_PROFILE_CACHE_TTL_MS
  );
}

function getFreshLinkedInProfileCache(prospectId?: string) {
  if (!prospectId) {
    return undefined;
  }

  const cached = linkedInProfileCache.get(prospectId);
  return cached && isFreshLinkedInProfileCache(cached.fetchedAt)
    ? cached
    : undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface LinkedInProfilePanelProps {
  prospectId?: string;
  profile?: LinkedInProfileData | null;
  className?: string;
  onBack?: () => void;
  onOpenConversation?: () => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function LinkedInProfilePanel({
  prospectId,
  profile,
  className,
  onBack,
  onOpenConversation,
  loading: externalLoading,
  error: externalError,
  onRetry,
}: LinkedInProfilePanelProps) {
  const isMobile = useIsMobile();
  const { push } = useRouter();
  const panelStack = useOptionalPanelStack();
  const getLinkedInProfile = useAction(
    (api as any).linkedin.getLinkedInProfile
  );
  const getLinkedInProfilePostsPage = useAction(
    (api as any).linkedin.getLinkedInProfilePostsPage
  );
  const getLinkedInProfileRelationship = useAction(
    (api as any).linkedin.getLinkedInProfileRelationship
  );
  const inviteLinkedInProspect = useAction(
    (api as any).linkedin.inviteLinkedInProspect
  );
  const [resolvedProfile, setResolvedProfile] =
    React.useState<LinkedInProfileData | null>(profile ?? null);
  const [loading, setLoading] = React.useState(
    externalLoading || (!profile && Boolean(prospectId) && !externalError)
  );
  const [error, setError] = React.useState<string | undefined>(externalError);
  const [activeTab, setActiveTab] = React.useState("posts");
  const [nextPostsCursor, setNextPostsCursor] = React.useState<string | null>(
    profile?.recentPostsCursor ?? null
  );
  const [loadingMorePosts, setLoadingMorePosts] = React.useState(false);
  const [loadingInitialPosts, setLoadingInitialPosts] = React.useState(false);
  const [postsError, setPostsError] = React.useState<string | undefined>();
  const initialPostsRequestedRef = React.useRef<Set<string>>(new Set());
  const relationshipRequestedRef = React.useRef<Set<string>>(new Set());
  const [connectionState, setConnectionState] = React.useState<
    LinkedInProfileData["connectionStatus"]
  >(profile?.connectionStatus);
  const [relationshipLoading, setRelationshipLoading] = React.useState(false);
  const [relationshipUnavailable, setRelationshipUnavailable] =
    React.useState(false);
  const [pendingConnectionAction, setPendingConnectionAction] =
    React.useState(false);

  const loadProfile = React.useCallback(
    async (force = false) => {
      if (!prospectId) {
        setResolvedProfile(profile ?? null);
        setLoading(false);
        setError(externalError);
        setNextPostsCursor(profile?.recentPostsCursor ?? null);
        return;
      }

      if (profile) {
        setResolvedProfile(profile);
        setLoading(false);
        setError(externalError);
        setNextPostsCursor(profile.recentPostsCursor ?? null);
        linkedInProfileCache.set(prospectId, {
          profile,
          fetchedAt: getCurrentUTCTimestamp(),
        });
        return;
      }

      const cached = !force
        ? getFreshLinkedInProfileCache(prospectId)
        : undefined;
      if (cached) {
        setResolvedProfile(cached.profile);
        setLoading(false);
        setError(undefined);
        setNextPostsCursor(cached.profile.recentPostsCursor ?? null);
        return;
      }

      const existingRequest = linkedInProfileInflight.get(prospectId);
      const request =
        existingRequest ??
        (
          getLinkedInProfile({
            prospectId,
          }) as Promise<LinkedInProfileData | null>
        ).finally(() => {
          linkedInProfileInflight.delete(prospectId);
        });

      if (!existingRequest) {
        linkedInProfileInflight.set(prospectId, request);
      }

      try {
        setLoading(true);
        const result = await request;
        if (!result) {
          throw new Error("Could not load LinkedIn profile.");
        }

        linkedInProfileCache.set(prospectId, {
          profile: result,
          fetchedAt: getCurrentUTCTimestamp(),
        });
        if (result.urn && result.recentPosts.length === 0) {
          initialPostsRequestedRef.current.delete(result.urn);
        }
        setResolvedProfile(result);
        setError(undefined);
        setNextPostsCursor(result.recentPostsCursor ?? null);
      } catch (err) {
        setResolvedProfile(null);
        setNextPostsCursor(null);
        setError(
          err instanceof Error
            ? err.message
            : "Could not load LinkedIn profile."
        );
      } finally {
        setLoading(false);
      }
    },
    [externalError, getLinkedInProfile, profile, prospectId]
  );

  React.useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const profileData = resolvedProfile ?? profile ?? null;

  React.useEffect(() => {
    setConnectionState(profileData?.connectionStatus);
  }, [profileData?.connectionStatus, profileData?.urn]);

  const profileUrl =
    profileData?.profileUrl ||
    (profileData?.username
      ? `https://linkedin.com/in/${profileData.username}`
      : undefined);

  const currentPosition = profileData?.positions?.find((p) => p.isCurrent);

  const primaryWebsite =
    profileData?.contact?.websites?.[0] ||
    (profileData?.currentCompany?.website
      ? { url: profileData.currentCompany.website, category: "COMPANY" }
      : undefined);

  const followerParts = getAnimatedParts(profileData?.followerCount ?? 0);
  const connectionParts = getAnimatedParts(profileData?.connectionCount ?? 0);
  const recentPosts = React.useMemo(
    () => profileData?.recentPosts ?? [],
    [profileData?.recentPosts]
  );
  const mergedRecentPosts = useLinkedInPostEngagementMerge(recentPosts);
  const positions = profileData?.positions ?? [];
  const education = profileData?.education ?? [];
  const skills = profileData?.skills ?? [];
  const featuredPosts = profileData?.featuredPosts ?? [];
  const languages = profileData?.languages ?? [];
  const relationshipKeyForRender = profileData?.urn ?? profileData?.username;
  const relationshipRequestStarted = relationshipKeyForRender
    ? relationshipRequestedRef.current.has(relationshipKeyForRender)
    : false;
  const isRelationshipStatusPending =
    profileData?.viewerAccountConnected === true &&
    profileData.relationshipStatusKnown !== true &&
    !relationshipUnavailable &&
    (!relationshipRequestStarted || relationshipLoading);
  const isRelationshipActionUnavailable =
    profileData?.viewerAccountConnected === true &&
    profileData.relationshipStatusKnown !== true &&
    !relationshipLoading;

  React.useEffect(() => {
    const profileUrn = profileData?.urn;
    const requestedProfileData = profileData;
    if (
      !prospectId ||
      !requestedProfileData ||
      !profileUrn ||
      loading ||
      recentPosts.length > 0 ||
      initialPostsRequestedRef.current.has(profileUrn)
    ) {
      return;
    }

    let cancelled = false;
    initialPostsRequestedRef.current.add(profileUrn);
    setLoadingInitialPosts(true);
    setPostsError(undefined);

    void (async () => {
      try {
        const result = (await getLinkedInProfilePostsPage({
          prospectId,
          profileUrn,
          limit: 10,
        })) as { posts?: UnifiedPost[]; nextCursor?: string | null };
        if (cancelled) {
          return;
        }

        const nextCursor =
          typeof result.nextCursor === "string" ? result.nextCursor : null;
        setResolvedProfile((currentProfile) => {
          const baseProfile = currentProfile ?? requestedProfileData;
          const nextProfile = {
            ...baseProfile,
            recentPosts: dedupeLinkedInPosts([
              ...baseProfile.recentPosts,
              ...(result.posts ?? []),
            ]),
            recentPostsCursor: nextCursor,
          } satisfies LinkedInProfileData;

          linkedInProfileCache.set(prospectId, {
            profile: nextProfile,
            fetchedAt: getCurrentUTCTimestamp(),
          });

          return nextProfile;
        });
        setNextPostsCursor(nextCursor);
      } catch (initialPostsError) {
        if (!cancelled) {
          setPostsError(
            initialPostsError instanceof Error
              ? initialPostsError.message
              : "Could not load LinkedIn posts."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingInitialPosts(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    getLinkedInProfilePostsPage,
    loading,
    profileData?.urn,
    prospectId,
    recentPosts.length,
  ]);

  React.useEffect(() => {
    const relationshipKey = profileData?.urn ?? profileData?.username;
    const requestedProfileData = profileData;
    if (
      !prospectId ||
      !requestedProfileData ||
      !relationshipKey ||
      loading ||
      requestedProfileData.viewerAccountConnected !== true ||
      requestedProfileData.relationshipStatusKnown === true ||
      relationshipRequestedRef.current.has(relationshipKey)
    ) {
      return;
    }

    let cancelled = false;
    let settled = false;
    relationshipRequestedRef.current.add(relationshipKey);
    setRelationshipLoading(true);
    setRelationshipUnavailable(false);

    const timeoutId = window.setTimeout(() => {
      if (cancelled || settled) {
        return;
      }
      settled = true;
      setRelationshipUnavailable(true);
      setRelationshipLoading(false);
    }, LINKEDIN_RELATIONSHIP_CHECK_TIMEOUT_MS);

    void (async () => {
      const relationship = (await getLinkedInProfileRelationship({
        prospectId,
      }).catch(() => null)) as Partial<LinkedInProfileData> | null;
      if (cancelled || settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);

      if (!relationship) {
        if (!cancelled) {
          setRelationshipUnavailable(true);
        }
        return;
      }

      setResolvedProfile((currentProfile) => {
        const baseProfile = currentProfile ?? requestedProfileData;
        const nextProfile = {
          ...baseProfile,
          ...relationship,
          recentPosts: baseProfile.recentPosts,
          recentPostsCursor: baseProfile.recentPostsCursor,
        } satisfies LinkedInProfileData;

        linkedInProfileCache.set(prospectId, {
          profile: nextProfile,
          fetchedAt: getCurrentUTCTimestamp(),
        });

        return nextProfile;
      });

      if (relationship.relationshipStatusKnown === true) {
        setConnectionState(relationship.connectionStatus);
        setRelationshipUnavailable(false);
      } else {
        setRelationshipUnavailable(true);
      }
    })().finally(() => {
      if (!cancelled && settled) {
        setRelationshipLoading(false);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    getLinkedInProfileRelationship,
    loading,
    profileData?.relationshipStatusKnown,
    profileData?.urn,
    profileData?.username,
    profileData?.viewerAccountConnected,
    prospectId,
  ]);

  const openPostThread = React.useCallback(
    (post: UnifiedPost) => {
      if (!post?.id) {
        return;
      }

      if (panelStack) {
        panelStack.pushPanel("linkedin-post-thread", {
          post,
          prospectId,
        });
        return;
      }

      const id = String(post.id);
      const params = new URLSearchParams();
      try {
        params.set("t", base64UrlEncodeUtf8(JSON.stringify(post)));
      } catch {}
      push(
        `/post/linkedin/${id}${params.toString() ? `?${params.toString()}` : ""}`,
        { scroll: false }
      );
    },
    [panelStack, prospectId, push]
  );

  const handleLoadMorePosts = React.useCallback(async () => {
    if (
      !prospectId ||
      !profileData?.urn ||
      !nextPostsCursor ||
      loadingMorePosts
    ) {
      return;
    }

    try {
      setLoadingMorePosts(true);
      const result = (await getLinkedInProfilePostsPage({
        prospectId,
        profileUrn: profileData.urn,
        cursor: nextPostsCursor,
        limit: 20,
      })) as { posts?: UnifiedPost[]; nextCursor?: string | null };
      const nextCursor =
        typeof result.nextCursor === "string" ? result.nextCursor : null;
      const nextProfile =
        profileData &&
        ({
          ...profileData,
          recentPosts: dedupeLinkedInPosts([
            ...(recentPosts ?? []),
            ...(result.posts ?? []),
          ]),
          recentPostsCursor: nextCursor,
        } satisfies LinkedInProfileData);
      if (nextProfile) {
        setResolvedProfile(nextProfile);
        linkedInProfileCache.set(prospectId, {
          profile: nextProfile,
          fetchedAt: getCurrentUTCTimestamp(),
        });
      }
      setNextPostsCursor(nextCursor);
    } catch (loadMoreError) {
      toast.error("Could not load more LinkedIn posts", {
        description:
          loadMoreError instanceof Error
            ? loadMoreError.message
            : "Please try again.",
      });
    } finally {
      setLoadingMorePosts(false);
    }
  }, [
    getLinkedInProfilePostsPage,
    loadingMorePosts,
    nextPostsCursor,
    profileData,
    prospectId,
    recentPosts,
  ]);

  const handleConnectionAction = React.useCallback(async () => {
    if (profileData?.viewerAccountConnected !== true) {
      push("/settings/connected-accounts");
      return;
    }

    if (relationshipLoading || relationshipUnavailable) {
      return;
    }

    if (profileData.relationshipStatusKnown !== true) {
      return;
    }

    if (
      !prospectId ||
      pendingConnectionAction ||
      connectionState === "pending"
    ) {
      return;
    }

    if (connectionState === "connected") {
      toast.message("LinkedIn connection already synced", {
        description:
          "This profile is already connected. Removing first-degree LinkedIn connections is not supported from ReacherX yet.",
      });
      return;
    }

    const previousConnectionState = connectionState;

    try {
      setPendingConnectionAction(true);
      setConnectionState("pending");
      await inviteLinkedInProspect({ prospectId });
      toast.success("LinkedIn invite sent", {
        description: "The connection request is now pending.",
      });
      void loadProfile(true);
    } catch (inviteError) {
      setConnectionState(previousConnectionState);
      toast.error("Could not send LinkedIn invite", {
        description:
          inviteError instanceof Error
            ? inviteError.message
            : "Please try again.",
      });
      void loadProfile(true);
    } finally {
      setPendingConnectionAction(false);
    }
  }, [
    connectionState,
    inviteLinkedInProspect,
    loadProfile,
    pendingConnectionAction,
    relationshipLoading,
    relationshipUnavailable,
    profileData?.viewerAccountConnected,
    profileData?.relationshipStatusKnown,
    prospectId,
    push,
  ]);

  // -----------------------------------------------------------------------
  // Loading skeleton
  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  const errorState = (
    <div className="px-4 pt-4">
      <Alert>
        <AlertTitle>Could not load profile</AlertTitle>
        <AlertDescription>
          {error}
          <div className="mt-3 flex gap-2">
            <Button
              size="xs"
              onClick={() => void (onRetry ? onRetry() : loadProfile(true))}
            >
              Retry
            </Button>
            <Button size="xs" variant="outline" onClick={onBack}>
              Close
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );

  // -----------------------------------------------------------------------
  // Profile header (hero)
  // -----------------------------------------------------------------------
  const profileHeader = profileData ? (
    <section className="border-b pb-4" aria-label="Profile summary">
      {/* Banner */}
      {profileData.backgroundImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profileData.backgroundImageUrl}
          alt={`${profileData.displayName} banner`}
          className="h-44 w-full border-b object-cover"
        />
      ) : (
        <div className="bg-muted h-44 w-full border-b" aria-hidden="true" />
      )}

      <div className="mx-4 -mt-7 space-y-3">
        {/* Avatar */}
        <header className="space-y-3">
          <Avatar className="ring-border ring-offset-background size-12 ring-1 ring-offset-2">
            {profileData.profilePictureUrl ? (
              <AvatarImage
                src={profileData.profilePictureUrl}
                alt={profileData.displayName}
              />
            ) : null}
            <AvatarFallback>
              {profileData.firstName?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>

          {/* Name + badge + location + actions */}
          <div className="space-y-2">
            {/* Row 1: Name + action buttons */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1">
                {profileUrl ? (
                  <Link
                    href={profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block min-w-0 truncate text-sm font-medium hover:underline"
                    title={profileData.displayName}
                  >
                    {profileData.displayName}
                  </Link>
                ) : (
                  <span className="text-sm font-medium">
                    {profileData.displayName}
                  </span>
                )}
                {profileData.isPremium ? (
                  <NewReleasesIcon
                    className="size-3.5 shrink-0 fill-current"
                    aria-hidden="true"
                  />
                ) : null}
              </div>

              {/* Action buttons */}
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="xs"
                  variant={
                    connectionState === "connected" ? "outline" : "default"
                  }
                  disabled={
                    pendingConnectionAction ||
                    isRelationshipStatusPending ||
                    isRelationshipActionUnavailable ||
                    connectionState === "pending" ||
                    (profileData.viewerAccountConnected === true && !prospectId)
                  }
                  title={
                    isRelationshipActionUnavailable
                      ? "Could not verify this LinkedIn relationship right now."
                      : undefined
                  }
                  onClick={() => void handleConnectionAction()}
                >
                  {pendingConnectionAction
                    ? "Connecting..."
                    : profileData.viewerAccountConnected !== true
                      ? "Connect account"
                      : isRelationshipStatusPending
                        ? "Checking..."
                        : isRelationshipActionUnavailable
                          ? "Unavailable"
                      : connectionState === "connected"
                        ? "Connected"
                        : connectionState === "pending"
                          ? "Pending"
                          : "Connect"}
                </Button>

                {/* Message */}
                {onOpenConversation ? (
                  <Button
                    variant="outline"
                    size="xsIcon"
                    aria-label="Message on LinkedIn"
                    onClick={onOpenConversation}
                  >
                    <MailIcon className="fill-current" />
                  </Button>
                ) : null}

                {/* More menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="xsIcon"
                      aria-label="Profile menu"
                    >
                      <MoreHorizIcon className="fill-current" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {profileUrl ? (
                      <DropdownMenuItem
                        onClick={() => window.open(profileUrl, "_blank")}
                      >
                        <OpenInNewIcon className="fill-current" />
                        Open on LinkedIn
                      </DropdownMenuItem>
                    ) : null}
                    {profileUrl ? (
                      <DropdownMenuItem
                        onClick={() =>
                          navigator.clipboard.writeText(profileUrl).then(
                            () =>
                              toast.success("Copied!", {
                                description: "Profile link copied.",
                              }),
                            () =>
                              toast.error("Error!", {
                                description: "Unable to copy link.",
                              })
                          )
                        }
                      >
                        <LinkIcon className="fill-current" />
                        Copy profile link
                      </DropdownMenuItem>
                    ) : null}
                    {profileData.contact?.emailAddress ? (
                      <DropdownMenuItem
                        onClick={() =>
                          navigator.clipboard
                            .writeText(profileData.contact!.emailAddress!)
                            .then(
                              () =>
                                toast.success("Copied!", {
                                  description: "Email copied.",
                                }),
                              () =>
                                toast.error("Error!", {
                                  description: "Unable to copy email.",
                                })
                            )
                        }
                      >
                        <AlternateEmailIcon className="fill-current" />
                        Copy email address
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Row 2: Headline + Location */}
            {profileData.headline ? (
              <p className="text-muted-foreground line-clamp-2 text-sm">
                {profileData.headline}
              </p>
            ) : null}
            {profileData.location ? (
              <p className="text-muted-foreground text-xs">
                {profileData.location}
              </p>
            ) : null}
          </div>
        </header>

        {/* Stats strip: connections · followers · company · website */}
        {(() => {
          const items: React.ReactElement[] = [];
          if ((profileData.connectionCount ?? 0) > 0) {
            items.push(
              <li key="conn" className="inline-flex items-center">
                <span className="text-foreground font-mono font-medium">
                  <AnimatedNumber
                    value={connectionParts.value}
                    suffix={
                      connectionParts.suffix
                        ? `${connectionParts.suffix}+`
                        : "+"
                    }
                    decimals={connectionParts.decimals}
                    format={{ useGrouping: false }}
                    animateOnMount
                  />
                </span>
                &nbsp;connections
              </li>
            );
          }
          if ((profileData.followerCount ?? 0) > 0) {
            items.push(
              <li key="foll" className="inline-flex items-center">
                <span className="text-foreground font-mono font-medium">
                  <AnimatedNumber
                    value={followerParts.value}
                    suffix={followerParts.suffix}
                    decimals={followerParts.decimals}
                    format={{ useGrouping: false }}
                    animateOnMount
                  />
                </span>
                &nbsp;followers
              </li>
            );
          }
          if (currentPosition) {
            items.push(
              <li key="co" className="inline-flex items-center gap-1">
                {currentPosition.companyLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentPosition.companyLogo}
                    alt=""
                    className="size-3.5 rounded-sm object-contain"
                  />
                ) : null}
                <span className="text-foreground font-medium">
                  {currentPosition.companyName}
                </span>
              </li>
            );
          }
          if (primaryWebsite) {
            items.push(
              <li key="web" className="inline-flex items-center gap-1">
                <LinkIcon className="fill-muted-foreground" />
                <Link
                  href={primaryWebsite.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground font-mono font-medium hover:underline"
                  title={primaryWebsite.url}
                >
                  {safeHostname(primaryWebsite.url)}
                </Link>
              </li>
            );
          }
          if (items.length === 0) return null;
          return (
            <ul
              className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-2 text-sm"
              role="list"
              aria-label="Profile stats"
            >
              {items.map((item, idx) => (
                <React.Fragment key={item.key ?? `profile-stat-${idx}`}>
                  {idx > 0 ? (
                    <li aria-hidden className="px-0.5">
                      ·
                    </li>
                  ) : null}
                  {item}
                </React.Fragment>
              ))}
            </ul>
          );
        })()}
      </div>
    </section>
  ) : null;

  // -----------------------------------------------------------------------
  // Posts tab
  // -----------------------------------------------------------------------
  const showInitialPostSkeletons =
    loadingInitialPosts && recentPosts.length === 0;
  const postsTab = (
    <TabsContent value="posts">
      <div className="divide-y">
        {mergedRecentPosts.length > 0
          ? mergedRecentPosts.map((post, index) => (
              <div
                key={post.id}
                className={cn("px-4 pb-2", index === 0 ? "pt-4" : "pt-2")}
              >
                <LinkedInPostCard
                  post={post}
                  prospectId={prospectId}
                  characterLimit={300}
                  readOnly={false}
                  disableExternalNavigation
                  onClick={() => openPostThread(post)}
                  commentBehavior="open_thread"
                  onToggleComments={(linkedinPost) =>
                    openPostThread(linkedinPost)
                  }
                />
              </div>
            ))
          : null}

        {showInitialPostSkeletons
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`initial-post-skeleton-${index}`}
                className={cn("px-4 pb-2", index === 0 ? "pt-4" : "pt-2")}
              >
                <LinkedInPostCardSkeleton />
              </div>
            ))
          : null}

        {!showInitialPostSkeletons && recentPosts.length === 0 ? (
          <div className="text-muted-foreground px-4 py-8 text-sm">
            {postsError || "No posts found."}
          </div>
        ) : null}
      </div>

      {nextPostsCursor ? (
        <div className="p-4">
          <Button
            size="xs"
            className="mx-auto block"
            disabled={loadingMorePosts}
            onClick={() => void handleLoadMorePosts()}
          >
            {loadingMorePosts ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </TabsContent>
  );

  // -----------------------------------------------------------------------
  // About tab
  // -----------------------------------------------------------------------
  const aboutTab = (
    <TabsContent value="about">
      {profileData?.summary ? (
        <section className="pt-3 pb-1">
          <h3 className="px-4 text-sm font-medium">About</h3>
          <div className="mt-1 px-4 py-3">
            <ExpandableTextBlock
              key={`about-${profileData.summary}`}
              text={profileData.summary}
            />
          </div>
        </section>
      ) : null}

      {/* Experience */}
      {positions.length > 0 ? (
        <section
          className={cn(
            profileData?.summary ? "border-t pt-3 pb-1" : "pt-3 pb-1"
          )}
        >
          <h3 className="px-4 text-sm font-medium">Experience</h3>
          <div className="mt-1 divide-y">
            {groupPositionsByCompany(positions).map((group) =>
              group.positions.length === 1 ? (
                /* Single role at company — flat layout */
                <div
                  key={`${group.companyName}-${group.positions[0].title}`}
                  className="flex gap-3 px-4 py-3"
                >
                  <Avatar className="mt-0.5 size-8 shrink-0 rounded-md">
                    {group.companyLogo ? (
                      <AvatarImage
                        src={group.companyLogo}
                        alt={group.companyName}
                        className="object-contain"
                      />
                    ) : null}
                    <AvatarFallback className="rounded-md text-xs">
                      {group.companyName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {group.positions[0].title}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {group.companyName}
                      {group.positions[0].employmentType ? (
                        <>
                          <Dot />
                          {group.positions[0].employmentType}
                        </>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatPositionDuration(
                        group.positions[0].start,
                        group.positions[0].end
                      )}
                      {group.positions[0].location ? (
                        <>
                          <Dot />
                          {group.positions[0].location}
                        </>
                      ) : null}
                    </p>
                    {group.positions[0].description ? (
                      <ExpandableTextBlock
                        key={`experience-${group.companyName}-${group.positions[0].title}`}
                        text={group.positions[0].description}
                        className="mt-1.5"
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                /* Multiple roles at same company — grouped with Timeline */
                <div key={`group-${group.companyName}`} className="px-4 py-3">
                  {/* Company header */}
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 shrink-0 rounded-md">
                      {group.companyLogo ? (
                        <AvatarImage
                          src={group.companyLogo}
                          alt={group.companyName}
                          className="object-contain"
                        />
                      ) : null}
                      <AvatarFallback className="rounded-md text-xs">
                        {group.companyName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{group.companyName}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatPositionDuration(
                          group.positions[group.positions.length - 1].start,
                          group.positions[0].end ?? group.positions[0].start
                        )}
                      </p>
                    </div>
                  </div>
                  {/* Sub-positions */}
                  <div className="mt-2">
                    {group.positions.map((pos, i) => (
                      <div
                        key={`${group.companyName}-${pos.title}-${pos.start?.year ?? "start"}-${pos.end?.year ?? "present"}`}
                        className="flex gap-3"
                      >
                        {/* Timeline column – matches company avatar width */}
                        <div className="flex w-8 shrink-0 flex-col items-center">
                          <div className="border-primary/20 mt-1 size-3 shrink-0 rounded-full border-2" />
                          {i < group.positions.length - 1 ? (
                            <div className="bg-primary/10 w-0.5 flex-1" />
                          ) : null}
                        </div>
                        {/* Position content */}
                        <div
                          className={cn(
                            "min-w-0",
                            i < group.positions.length - 1 && "pb-4"
                          )}
                        >
                          <p className="text-sm font-medium">{pos.title}</p>
                          <p className="text-muted-foreground text-xs">
                            {formatPositionDuration(pos.start, pos.end)}
                            {pos.employmentType ? (
                              <>
                                <Dot />
                                {pos.employmentType}
                              </>
                            ) : null}
                            {pos.location ? (
                              <>
                                <Dot />
                                {pos.location}
                              </>
                            ) : null}
                          </p>
                          {pos.description ? (
                            <ExpandableTextBlock
                              key={`${group.companyName}-${pos.title}-${pos.description}`}
                              text={pos.description}
                              className="mt-1"
                            />
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      ) : null}

      {/* Education */}
      {education.length > 0 ? (
        <section className="border-t pt-3 pb-1">
          <h3 className="px-4 text-sm font-medium">Education</h3>
          <div className="mt-1 divide-y">
            {education.map((edu) => (
              <div
                key={`${edu.school}-${edu.degree ?? "degree"}-${edu.fieldOfStudy ?? "field"}-${edu.start?.year ?? "start"}`}
                className="flex gap-3 px-4 py-3"
              >
                <Avatar className="mt-0.5 size-8 shrink-0 rounded-md">
                  {edu.schoolLogo ? (
                    <AvatarImage
                      src={edu.schoolLogo}
                      alt={edu.school}
                      className="object-contain"
                    />
                  ) : null}
                  <AvatarFallback className="rounded-md text-xs">
                    {edu.school.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{edu.school}</p>
                  {edu.degree || edu.fieldOfStudy ? (
                    <p className="text-muted-foreground text-sm">
                      {[edu.degree, edu.fieldOfStudy]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}
                  {edu.start?.year ? (
                    <p className="text-muted-foreground text-xs">
                      {[edu.start?.year, edu.end?.year]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Skills */}
      {skills.length > 0 ? (
        <section className="border-t pt-3 pb-3">
          <h3 className="px-4 text-sm font-medium">Skills</h3>
          <div className="mt-2 flex flex-wrap gap-1.5 px-4">
            {skills.slice(0, 12).map((skill) => (
              <Badge key={skill.name} variant="outline" className="font-normal">
                {skill.name}
                {skill.passedAssessment ? (
                  <CheckCircleIcon className="ml-0.5 size-3 fill-current" />
                ) : null}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {/* Featured */}
      {featuredPosts.length > 0 ? (
        <section className="border-t pt-3 pb-1">
          <h3 className="px-4 text-sm font-medium">Featured</h3>
          <div className="divide-y">
            {featuredPosts.map((item, i) => (
              <a
                key={item.url || i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block px-4 py-3"
              >
                {item.type ? (
                  <p className="text-muted-foreground mb-1 text-xs">
                    {item.type}
                  </p>
                ) : null}
                <p className="text-sm font-medium group-hover:underline">
                  {item.title || "Untitled"}
                </p>
                {item.text ? (
                  <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
                    {item.text}
                  </p>
                ) : null}
                {item.type === "Article" && item.url ? (
                  <div className="mt-2">
                    <OpenGraphPreview
                      url={item.url}
                      context="timeline"
                      debounceMs={300}
                      enableCache
                      retryOnError
                    />
                  </div>
                ) : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* Contact */}
      {profileData?.contact &&
      (profileData.contact.emailAddress ||
        (profileData.contact.websites?.length ?? 0) > 0) ? (
        <section className="border-t pt-3 pb-3">
          <h3 className="px-4 text-sm font-medium">Contact</h3>
          <div className="mt-2 space-y-2 px-4 text-sm">
            {profileData.contact.emailAddress ? (
              <p className="flex items-center gap-2">
                <AlternateEmailIcon className="fill-muted-foreground shrink-0" />
                <span className="truncate font-mono">
                  {profileData.contact.emailAddress}
                </span>
              </p>
            ) : null}
            {profileData.contact.websites?.map((site) => (
              <p key={site.url} className="flex items-center gap-2">
                <LinkIcon className="fill-muted-foreground shrink-0" />
                <Link
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground truncate font-mono hover:underline"
                >
                  {safeHostname(site.url)}
                </Link>
                <span className="text-muted-foreground">
                  ({site.category.toLowerCase()})
                </span>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* Languages */}
      {languages.length > 0 ? (
        <section className="border-t pt-3 pb-3">
          <h3 className="px-4 text-sm font-medium">Languages</h3>
          <div className="mt-2 space-y-1.5 px-4 text-sm">
            {languages.map((lang) => (
              <p key={lang.name}>
                <span className="font-medium">{lang.name}</span>
                {lang.proficiency ? (
                  <span className="text-muted-foreground">
                    {" "}
                    &ndash; {formatProficiency(lang.proficiency)}
                  </span>
                ) : null}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* Current Company */}
      {profileData?.currentCompany ? (
        <section className="border-t pt-3 pb-3">
          <h3 className="px-4 text-sm font-medium">Company</h3>
          <div className="mt-2 space-y-2 px-4 text-sm">
            <div className="flex items-start gap-3">
              <Avatar className="size-10 shrink-0 rounded-md">
                {profileData.currentCompany.logoUrl ? (
                  <AvatarImage
                    src={profileData.currentCompany.logoUrl}
                    alt={profileData.currentCompany.name}
                    className="object-contain"
                  />
                ) : null}
                <AvatarFallback className="rounded-md">
                  {profileData.currentCompany.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium">{profileData.currentCompany.name}</p>
                {profileData.currentCompany.industry ||
                profileData.currentCompany.staffCount != null ||
                profileData.currentCompany.founded ? (
                  <p className="text-muted-foreground text-xs">
                    {[
                      profileData.currentCompany.industry,
                      profileData.currentCompany.staffCount != null
                        ? `${profileData.currentCompany.staffCount} employees`
                        : undefined,
                      profileData.currentCompany.founded
                        ? `Founded ${profileData.currentCompany.founded}`
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(" \u00B7 ")}
                  </p>
                ) : null}
              </div>
            </div>
            {profileData.currentCompany.description ? (
              <ExpandableTextBlock
                key={`company-${profileData.currentCompany.description}`}
                text={profileData.currentCompany.description}
                textClassName="text-muted-foreground"
              />
            ) : null}
            {profileData.currentCompany.website ? (
              <p className="flex items-center gap-1">
                <LinkIcon className="fill-muted-foreground shrink-0" />
                <Link
                  href={profileData.currentCompany.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground font-mono hover:underline"
                >
                  {safeHostname(profileData.currentCompany.website)}
                </Link>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </TabsContent>
  );

  // -----------------------------------------------------------------------
  // Panel content
  // -----------------------------------------------------------------------
  const panel = (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex h-full flex-col md:w-full">
        <PageHeader title="Profile" onBack={onBack} />
        <ScrollArea
          className="min-h-0 flex-1 overscroll-contain"
          viewportClassName="pb-6"
        >
          <PageContent>
            {loading ? LINKEDIN_PROFILE_LOADING_SKELETON : null}

            {error && !profileData ? errorState : null}

            {!loading && profileData ? (
              <>
                {profileHeader}

                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="-mt-4"
                >
                  <div className="border-b">
                    <div className="px-4">
                      <TabsList variant="underline">
                        <TabsTrigger value="posts" variant="underline">
                          Posts
                        </TabsTrigger>
                        <TabsTrigger value="about" variant="underline">
                          About
                        </TabsTrigger>
                      </TabsList>
                    </div>
                  </div>

                  {postsTab}
                  {aboutTab}
                </Tabs>
              </>
            ) : null}
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );

  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => !open && onBack?.()}>
        <DrawerContent className="mt-0 flex h-dvh max-h-dvh">
          <div className="flex h-full w-full flex-col">
            <div className="scroll-fade-effect-y min-h-0 flex-1 overflow-y-auto">
              {panel}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return panel;
}
