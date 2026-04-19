"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { useProspectDmState } from "@/features/prospects/hooks/useProspectDmState";
import {
  type ProfileMode,
  type ProfileUser,
  useProfile,
} from "../../contexts/TwitterProfileContext";
import { useTwitterTimelineEngagementMerge } from "@/shared/hooks/useTwitterTimelineEngagementMerge";
import { api } from "@/convex/_generated/api";
import { Button } from "@/shared/ui/components/Button";
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
import { Drawer, DrawerContent } from "@/shared/ui/components/Drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import {
  AlternateEmailIcon,
  EventIcon,
  LinkIcon,
  LocationOnIcon,
  MailIcon,
  MoreHorizIcon,
  NewReleasesIcon,
  OpenInNewIcon,
} from "@/shared/ui/components/icons";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/components/Tabs";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { formatLargeNumber, parseText, cn } from "@/shared/lib/utils";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { Tweet, TweetSkeleton } from "@/features/webapp/ui/components/tweet";
import type { Tweet as TweetType } from "@/features/threads/types";

function dedupeTweets<T extends { id_str?: string; id?: number }>(
  arr: T[] | undefined
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const tweet of arr || []) {
    const key = String(tweet?.id_str ?? tweet?.id ?? "");
    if (!key) {
      out.push(tweet);
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      out.push(tweet);
    }
  }
  return out;
}

function renderTimelineSection(args: {
  activeTab: ProfileMode;
  value: ProfileMode;
  tweets: TweetType[];
  loadingTab: boolean;
  error?: string;
  retryProfile: () => Promise<void>;
  loadMore: (mode?: ProfileMode) => Promise<void>;
  nextCursor?: string;
}) {
  const title =
    args.value === "posts"
      ? "posts"
      : args.value === "replies"
        ? "replies"
        : "quotes";

  return (
    <TabsContent value={args.value}>
      <div className="divide-y">
        {args.error &&
        args.activeTab === args.value &&
        args.tweets.length === 0 ? (
          <div className="px-4 py-4">
            <Alert>
              <AlertTitle>{`Could not load ${title}`}</AlertTitle>
              <AlertDescription>
                {args.error}
                <div className="mt-3">
                  <Button size="xs" onClick={() => void args.retryProfile()}>
                    Retry
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        {args.loadingTab &&
        args.activeTab === args.value &&
        args.tweets.length === 0
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`${args.value}-skeleton-${index}`}
                className="px-4 py-2"
              >
                <TweetSkeleton showThread={true} />
              </div>
            ))
          : null}

        {args.tweets.map((tweet, index) => (
          <div
            key={
              tweet.id_str ??
              (tweet.id != null ? String(tweet.id) : `${args.value}-${index}`)
            }
            className="px-4 py-2"
          >
            <Tweet tweet={tweet} characterLimit={280} showThread={true} />
          </div>
        ))}

        {!args.loadingTab &&
        !args.error &&
        args.tweets.length === 0 &&
        args.activeTab === args.value ? (
          <div className="text-muted-foreground px-4 py-8 text-sm">
            {`No ${title} found.`}
          </div>
        ) : null}
      </div>

      {args.nextCursor ? (
        <div className="p-4">
          <Button
            size="xs"
            className="mx-auto block"
            onClick={() => void args.loadMore(args.value)}
          >
            Load more
          </Button>
        </div>
      ) : null}
    </TabsContent>
  );
}

function getAnimatedPartsFromFormattedCount(value: number): {
  value: number;
  suffix?: string;
  decimals: number;
} {
  const formatted = formatLargeNumber(value);
  const match = /^(\d+(?:\.\d+)?)([A-Za-z]*)$/.exec(formatted);

  if (!match) {
    return { value, decimals: 0 };
  }

  return {
    value: Number(match[1]),
    suffix: match[2] || undefined,
    decimals: /\.\d/.test(match[1]) ? 1 : 0,
  };
}

export function TwitterProfilePanel({
  className,
  prospectId,
  onOpenConversation,
}: {
  className?: string;
  mobile?: boolean;
  prospectId?: string;
  onOpenConversation?: () => void;
}) {
  const {
    isOpen,
    profile,
    relationship,
    loadingProfile,
    loadingTab,
    activeTab,
    setTab,
    timelines,
    loadMore,
    cursors,
    closeProfile,
    error,
    retryProfile,
    refreshProfileDisplay,
  } = useProfile();
  const getXStatus = useAction(api.x.getTwitterConnectionStatus);
  const followUser = useAction(api.x.followUser);
  const unfollowUser = useAction(api.x.unfollowUser);
  const router = useRouter();
  const isMobile = useIsMobile();
  const [pendingFollowAction, setPendingFollowAction] = React.useState<
    "follow" | "unfollow" | null
  >(null);
  const dmState = useProspectDmState(prospectId, {
    enabled: Boolean(prospectId && onOpenConversation),
    platform: "twitter",
  });

  const postsTimeline = React.useMemo(
    () => dedupeTweets((timelines.posts as TweetType[]) || []),
    [timelines.posts]
  );
  const repliesTimeline = React.useMemo(
    () => dedupeTweets((timelines.replies as TweetType[]) || []),
    [timelines.replies]
  );
  const quotesTimeline = React.useMemo(
    () => dedupeTweets((timelines.quotes as TweetType[]) || []),
    [timelines.quotes]
  );

  const postsMerged = useTwitterTimelineEngagementMerge(postsTimeline);
  const repliesMerged = useTwitterTimelineEngagementMerge(repliesTimeline);
  const quotesMerged = useTwitterTimelineEngagementMerge(quotesTimeline);

  const username = profile?.screen_name || profile?.username;
  const profileUrl = username ? `https://x.com/${username}` : undefined;
  const bannerUrl: string | undefined =
    profile?.banner_url || profile?.profile_banner_url;

  const proxied = (url: string | undefined) =>
    url
      ? `/api/opengraph?asset=image&url=${encodeURIComponent(url)}${
          profileUrl ? `&ref=${encodeURIComponent(profileUrl)}` : ""
        }`
      : url;

  const followersCount = Number(profile?.followers_count ?? 0);
  const followingCount = Number(profile?.friends_count ?? 0);
  const postsCount = Number(profile?.statuses_count ?? 0);
  const formattedFollowersCount =
    getAnimatedPartsFromFormattedCount(followersCount);
  const formattedFollowingCount =
    getAnimatedPartsFromFormattedCount(followingCount);

  const websiteEntity =
    (profile as ProfileUser | undefined)?.entities?.url?.urls?.[0] || undefined;
  const websiteHref: string | undefined =
    websiteEntity?.expanded_url || profile?.url || undefined;

  const inlineRelationshipText =
    relationship?.resolution === "verified" &&
    relationship.badge === "you_following"
      ? "· You following ✓"
      : relationship?.resolution === "verified" &&
          relationship.badge === "follows_you"
        ? "· Follows you ✓"
        : undefined;

  const showMutualStrip =
    relationship?.resolution === "verified" && relationship.badge === "mutual";
  const dmEligibility = React.useMemo(
    () =>
      dmState.data?.eligibility ?? {
        enabled: false,
        reasonLabel: dmState.loading
          ? "Checking DM availability on X/Twitter..."
          : "DM eligibility unavailable right now.",
      },
    [dmState.data?.eligibility, dmState.loading]
  );

  const ensureConnected = React.useCallback(async () => {
    const status = await getXStatus({});
    if (!status?.isConnected) {
      toast.error("Connect your X/Twitter account", {
        description:
          "Connect X/Twitter via Settings → Connected accounts before using X/Twitter actions.",
        action: {
          label: "Open settings",
          onClick: () => router.push("/settings/connected-accounts"),
        },
      });
      return null;
    }
    return status;
  }, [getXStatus, router]);

  const handleFollowAction = React.useCallback(async () => {
    if (!profile?.id_str) {
      return;
    }

    const action = relationship?.primaryAction ?? "follow";
    const loadingLabel =
      action === "unfollow"
        ? "Unfollowing on X/Twitter..."
        : "Following on X/Twitter...";
    const successLabel =
      action === "unfollow"
        ? "Unfollowed on X/Twitter"
        : "Following on X/Twitter";

    const loadingToastId = toast.loading(loadingLabel);
    const status = await ensureConnected();
    if (!status) {
      toast.dismiss(loadingToastId);
      return;
    }

    setPendingFollowAction(action);
    try {
      if (action === "unfollow") {
        await unfollowUser({ targetUserId: profile.id_str });
      } else {
        await followUser({ targetUserId: profile.id_str });
      }
      await refreshProfileDisplay();
      toast.dismiss(loadingToastId);
      toast.success(successLabel);
    } catch {
      toast.dismiss(loadingToastId);
      toast.error("Unable to update follow state", {
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setPendingFollowAction(null);
    }
  }, [
    ensureConnected,
    followUser,
    profile?.id_str,
    refreshProfileDisplay,
    relationship?.primaryAction,
    unfollowUser,
  ]);

  if (!isOpen) {
    return null;
  }

  const panel = (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex h-full flex-col md:w-full">
        <PageHeader
          title="Profile"
          onBack={closeProfile}
          titleSuffix={
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1">
                <span className="text-foreground font-mono font-medium">
                  <AnimatedNumber
                    value={postsCount}
                    format={{ useGrouping: false }}
                    animateOnMount
                  />
                </span>
                Posts
              </span>
            </div>
          }
        />
        <ScrollArea
          className="min-h-0 flex-1 overscroll-contain"
          viewportClassName="pb-6"
        >
          <PageContent>
            {loadingProfile ? (
              <div className="border-b pb-4">
                <div className="bg-muted h-44 w-full border-b opacity-50" />
                <div className="mx-4 -mt-7 space-y-4">
                  <Skeleton className="ring-border h-12 w-12 rounded-full ring-1" />
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
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
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                </div>
              </div>
            ) : error && !profile ? (
              <div className="px-4 pt-4">
                <Alert>
                  <AlertTitle>Could not load profile</AlertTitle>
                  <AlertDescription>
                    {error}
                    <div className="mt-3 flex gap-2">
                      <Button size="xs" onClick={() => void retryProfile()}>
                        Retry
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={closeProfile}
                      >
                        Close
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            ) : profile ? (
              <section className="border-b pb-4" aria-label="Profile summary">
                {bannerUrl ? (
                  <Image
                    src={proxied(bannerUrl) as string}
                    alt={profile.name || "Profile banner"}
                    className="w-full border-b object-cover"
                    width={1200}
                    height={192}
                    priority
                    unoptimized
                  />
                ) : (
                  <div
                    className="bg-muted h-44 w-full border-b"
                    aria-hidden="true"
                  />
                )}

                <div className="mx-4 -mt-7 space-y-4">
                  <header className="space-y-3">
                    <Avatar className="ring-border ring-offset-background size-12 ring-1 ring-offset-2">
                      {profile.profile_image_url_https ? (
                        <AvatarImage
                          src={profile.profile_image_url_https}
                          alt={profile.name || "Profile picture"}
                        />
                      ) : null}
                      <AvatarFallback>
                        {profile.name?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex min-w-0 items-center gap-1">
                            {profile.name && profileUrl ? (
                              <Link
                                href={profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block max-w-[18rem] min-w-0 truncate text-sm font-medium hover:underline md:max-w-md"
                                aria-label={`View ${profile.name}'s profile on X/Twitter`}
                                title={profile.name}
                              >
                                {profile.name}
                              </Link>
                            ) : null}
                            {profile.verified ? (
                              <NewReleasesIcon
                                className="size-3.5 shrink-0 fill-current"
                                aria-hidden="true"
                              />
                            ) : null}
                            {inlineRelationshipText ? (
                              <span className="text-muted-foreground text-sm">
                                {inlineRelationshipText}
                              </span>
                            ) : null}
                          </div>

                          {username && profileUrl ? (
                            <Link
                              href={profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground block max-w-56 min-w-0 truncate font-mono text-sm font-medium hover:underline md:max-w-88"
                              aria-label={`Open @${username} on X/Twitter`}
                              title={`@${username}`}
                            >
                              @{username}
                            </Link>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="xs"
                            onClick={() => void handleFollowAction()}
                            disabled={pendingFollowAction !== null}
                          >
                            {pendingFollowAction === relationship?.primaryAction
                              ? `${relationship?.primaryLabel ?? "Follow"}...`
                              : (relationship?.primaryLabel ?? "Follow")}
                          </Button>

                          {onOpenConversation ? (
                            <Button
                              variant="outline"
                              size="xsIcon"
                              aria-label="DM on X/Twitter"
                              disabled={!dmEligibility.enabled}
                              onClick={
                                dmEligibility.enabled
                                  ? onOpenConversation
                                  : undefined
                              }
                              title={
                                !dmEligibility.enabled
                                  ? dmEligibility.reasonLabel
                                  : undefined
                              }
                            >
                              <MailIcon className="fill-current" />
                            </Button>
                          ) : null}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="xsIcon"
                                aria-label="Profile menu"
                              >
                                <MoreHorizIcon className="fill-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {profileUrl ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    window.open(profileUrl, "_blank")
                                  }
                                >
                                  <OpenInNewIcon className="fill-current" />
                                  Open on X/Twitter
                                </DropdownMenuItem>
                              ) : null}
                              {username ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigator.clipboard
                                      .writeText(`@${username}`)
                                      .then(
                                        () =>
                                          toast.success("Copied!", {
                                            description:
                                              "X/Twitter handle copied.",
                                          }),
                                        () =>
                                          toast.error("Error!", {
                                            description:
                                              "Unable to copy handle.",
                                          })
                                      )
                                  }
                                >
                                  <AlternateEmailIcon className="fill-current" />
                                  Copy X/Twitter handle
                                </DropdownMenuItem>
                              ) : null}
                              {profileUrl ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigator.clipboard
                                      .writeText(profileUrl)
                                      .then(
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
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </header>

                  {profile.description ? (
                    <p className="[&_a]:text-muted-foreground text-sm whitespace-pre-line [&_a]:hover:underline">
                      {parseText(profile.description, {
                        urls: profile.entities?.description?.urls || [],
                      })}
                    </p>
                  ) : null}

                  <ul
                    className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-2 text-sm"
                    role="list"
                    aria-label="User statistics"
                  >
                    <li>
                      <span className="text-foreground font-mono font-medium">
                        <AnimatedNumber
                          value={formattedFollowersCount.value}
                          suffix={formattedFollowersCount.suffix}
                          decimals={formattedFollowersCount.decimals}
                          format={{ useGrouping: false }}
                          animateOnMount
                        />
                      </span>{" "}
                      Followers
                    </li>
                    <li aria-hidden className="px-0.5">
                      ·
                    </li>
                    <li>
                      <span className="text-foreground font-mono font-medium">
                        <AnimatedNumber
                          value={formattedFollowingCount.value}
                          suffix={formattedFollowingCount.suffix}
                          decimals={formattedFollowingCount.decimals}
                          format={{ useGrouping: false }}
                          animateOnMount
                        />
                      </span>{" "}
                      Following
                    </li>
                    {websiteHref ? (
                      <>
                        <li aria-hidden className="px-0.5">
                          ·
                        </li>
                        <li className="min-w-0">
                          <Link
                            href={websiteHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground inline-flex max-w-full min-w-0 items-center gap-1 font-mono text-xs font-medium whitespace-nowrap hover:underline"
                            aria-label="Open website"
                            title={websiteHref}
                          >
                            <LinkIcon className="fill-muted-foreground" />
                            <span className="truncate">
                              {websiteEntity?.display_url || websiteHref}
                            </span>
                          </Link>
                        </li>
                      </>
                    ) : null}
                  </ul>

                  {showMutualStrip ? (
                    <div className="text-foreground text-sm font-medium">
                      You both follow each other.
                    </div>
                  ) : null}

                  <footer
                    className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-4 text-sm"
                    aria-label="Profile metadata"
                  >
                    {profile.location ? (
                      <span className="flex items-center gap-1">
                        <LocationOnIcon className="fill-muted-foreground" />
                        {profile.location}
                      </span>
                    ) : null}
                    {profile.created_at ? (
                      <time
                        dateTime={profile.created_at}
                        className="flex items-center gap-1"
                      >
                        <EventIcon className="fill-muted-foreground" />
                        Joined{" "}
                        {format(new Date(profile.created_at), "MMMM yyyy")}
                      </time>
                    ) : null}
                  </footer>
                </div>
              </section>
            ) : null}

            <div className="mt-2">
              <Tabs
                value={activeTab}
                onValueChange={(value) => void setTab(value as ProfileMode)}
              >
                <div className="mx-4 flex items-center justify-between">
                  <TabsList size="sm">
                    <TabsTrigger size="sm" value="posts">
                      Posts
                    </TabsTrigger>
                    <TabsTrigger size="sm" value="replies">
                      Replies
                    </TabsTrigger>
                    <TabsTrigger size="sm" value="quotes">
                      Quotes
                    </TabsTrigger>
                  </TabsList>
                </div>

                {renderTimelineSection({
                  activeTab,
                  value: "posts",
                  tweets: postsMerged,
                  loadingTab,
                  error,
                  retryProfile,
                  loadMore,
                  nextCursor: cursors.posts,
                })}
                {renderTimelineSection({
                  activeTab,
                  value: "replies",
                  tweets: repliesMerged,
                  loadingTab,
                  error,
                  retryProfile,
                  loadMore,
                  nextCursor: cursors.replies,
                })}
                {renderTimelineSection({
                  activeTab,
                  value: "quotes",
                  tweets: quotesMerged,
                  loadingTab,
                  error,
                  retryProfile,
                  loadMore,
                  nextCursor: cursors.quotes,
                })}
              </Tabs>
            </div>
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );

  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => !open && closeProfile()}>
        <DrawerContent className="mt-0 flex h-dvh max-h-dvh">
          <div className="flex h-full w-full flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return panel;
}
