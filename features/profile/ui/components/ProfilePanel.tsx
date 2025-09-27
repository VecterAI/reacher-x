"use client";

import * as React from "react";
import { useProfile } from "../../contexts/ProfileContext";
import { Button } from "@/shared/ui/components/Button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/shared/ui/components/Tabs";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import {
  MoreHorizIcon,
  LinkIcon,
  LocationOnIcon,
  EventIcon,
  AlternateEmailIcon,
  OpenInNewIcon,
} from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils/utils";
import { Tweet } from "@/features/threads/ui/components/Tweet";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import Image from "next/image";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import { parseText } from "@/shared/lib/utils/parseText";
import { formatLargeNumber } from "@/shared/lib/utils/format";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import type { ProfileMode, ProfileUser } from "../../contexts/ProfileContext";
import { format } from "date-fns";
import Link from "next/link";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { Drawer, DrawerContent } from "@/shared/ui/components/Drawer";

export function ProfilePanel({
  className,
}: {
  className?: string;
  mobile?: boolean;
}) {
  const {
    isOpen,
    profile,
    loadingProfile,
    activeTab,
    setTab,
    timelines,
    loadMore,
    cursors,
    closeProfile,
  } = useProfile();
  const isMobile = useIsMobile();

  const username = profile?.screen_name || profile?.username;
  const profileUrl = username ? `https://x.com/${username}` : undefined;
  const bannerUrl: string | undefined =
    profile?.banner_url || profile?.profile_banner_url;
  if (bannerUrl !== undefined) {
    // Log once when panel opens to help diagnose banner rendering
    console.log("ProfilePanel.banner_url:", bannerUrl);
  }

  // Animate mount once for stats
  const [animatedFollowers, setAnimatedFollowers] = React.useState(0);
  const [animatedFollowing, setAnimatedFollowing] = React.useState(0);
  React.useEffect(() => {
    const followers = Number(profile?.followers_count ?? 0);
    const friends = Number(profile?.friends_count ?? 0);
    // Trigger animation on mount/update (followers/following)
    const id = requestAnimationFrame(() => {
      setAnimatedFollowers(followers);
      setAnimatedFollowing(friends);
      // Posts number is now shown in the header via profile.statuses_count
    });
    return () => cancelAnimationFrame(id);
    // Re-run when viewing a different profile
  }, [
    profile?.id_str,
    profile?.id,
    profile?.followers_count,
    profile?.friends_count,
    profile?.statuses_count,
  ]);

  const websiteEntity =
    (profile as ProfileUser | undefined)?.entities?.url?.urls?.[0] || undefined;
  const websiteHref: string | undefined =
    websiteEntity?.expanded_url || profile?.url || undefined;

  if (!isOpen) return null;

  const panel = (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="md:w-full">
        <PageHeader
          title="Profile"
          onBack={closeProfile}
          stickyOffsetClassName={"top-0"}
          titleSuffix={
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1">
                <span className="font-mono font-medium text-foreground">
                  <AnimatedNumber
                    value={Number(profile?.statuses_count ?? 0)}
                    format={{ useGrouping: false }}
                  />
                </span>
                Posts
              </span>
            </div>
          }
        />
        <ScrollArea className="h-[calc(100dvh-3rem)] overscroll-contain">
          <PageContent>
            {loadingProfile ? (
              <div className="border-b pb-4">
                <div className="h-44 w-full border-b bg-muted opacity-50" />
                <div className="mx-4 -mt-7 space-y-4">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-12 w-12 rounded-full ring-1 ring-border" />
                  </div>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-6 w-6 rounded-md" />
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
            ) : profile ? (
              <section className="border-b pb-4" aria-label="Profile summary">
                {bannerUrl ? (
                  <Image
                    src={bannerUrl}
                    alt={profile.name || "Profile banner"}
                    className="w-full border-b object-cover"
                    width={1200}
                    height={192}
                    priority
                  />
                ) : (
                  <div
                    className="h-44 w-full border-b bg-muted"
                    aria-hidden="true"
                  />
                )}
                {/* negative margin top */}
                <div className="mx-4 -mt-7 space-y-4">
                  <header>
                    <Avatar className="size-12 ring-1 ring-border ring-offset-2 ring-offset-background">
                      {profile?.profile_image_url_https ? (
                        <AvatarImage
                          src={profile.profile_image_url_https}
                          alt={profile.name || "Profile picture"}
                        />
                      ) : null}
                      <AvatarFallback>
                        {profile.name?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="my-2 flex items-center gap-1">
                      <address className="not-italic">
                        <div className="flex items-center gap-1">
                          {profile.name && profileUrl && (
                            <Link
                              href={profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium hover:underline"
                              aria-label={`View ${profile.name}'s profile on X`}
                            >
                              {profile.name}
                            </Link>
                          )}
                          {profile.verified && (
                            <NewReleasesIcon
                              className="size-3.5 fill-current"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        {username && profileUrl && (
                          <Link
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sm font-medium text-muted-foreground hover:underline"
                            aria-label={`Open @${username} on X`}
                          >
                            @{username}
                          </Link>
                        )}
                      </address>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="xsIcon"
                            aria-label="Profile menu"
                            className="ml-auto"
                          >
                            <MoreHorizIcon className="fill-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>↳ Menu</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {profileUrl && (
                            <DropdownMenuItem
                              onClick={() => window.open(profileUrl, "_blank")}
                            >
                              <OpenInNewIcon className="fill-current" />
                              Open on X (Twitter)
                            </DropdownMenuItem>
                          )}
                          {username && (
                            <DropdownMenuItem
                              onClick={() =>
                                navigator.clipboard.writeText(`@${username}`)
                              }
                            >
                              <AlternateEmailIcon className="fill-current" />
                              Copy Twitter handle
                            </DropdownMenuItem>
                          )}
                          {profileUrl && (
                            <DropdownMenuItem
                              onClick={() =>
                                navigator.clipboard.writeText(profileUrl)
                              }
                            >
                              <LinkIcon className="fill-current" />
                              Copy profile link
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </header>

                  {profile.description && (
                    <p className="whitespace-pre-line text-sm [&_a]:text-muted-foreground hover:[&_a]:underline">
                      {parseText(profile.description, {
                        urls: profile?.entities?.description?.urls || [],
                      })}
                    </p>
                  )}

                  <ul
                    className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-muted-foreground"
                    role="list"
                    aria-label="User statistics"
                  >
                    {(() => {
                      const compact = formatLargeNumber(animatedFollowers);
                      const match = compact.match(
                        /^([0-9]+(?:\.[0-9])?)([A-Za-z]*)$/
                      );
                      const value = match
                        ? Number(match[1])
                        : animatedFollowers;
                      const suffix = match ? match[2] : "";
                      return (
                        <li>
                          <span className="font-mono font-medium text-foreground">
                            <AnimatedNumber
                              value={Number.isFinite(value) ? value : 0}
                              suffix={suffix}
                              format={{ useGrouping: false }}
                            />
                          </span>{" "}
                          Followers
                        </li>
                      );
                    })()}
                    <li aria-hidden className="px-0.5">
                      ·
                    </li>
                    {(() => {
                      const compact = formatLargeNumber(animatedFollowing);
                      const match = compact.match(
                        /^([0-9]+(?:\.[0-9])?)([A-Za-z]*)$/
                      );
                      const value = match
                        ? Number(match[1])
                        : animatedFollowing;
                      const suffix = match ? match[2] : "";
                      return (
                        <li>
                          <span className="font-mono font-medium text-foreground">
                            <AnimatedNumber
                              value={Number.isFinite(value) ? value : 0}
                              suffix={suffix}
                              format={{ useGrouping: false }}
                            />
                          </span>{" "}
                          Following
                        </li>
                      );
                    })()}
                    {websiteHref && (
                      <>
                        <li aria-hidden className="px-0.5">
                          ·
                        </li>
                        <li className="min-w-0">
                          <Link
                            href={websiteHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1 font-mono text-xs font-medium text-foreground hover:underline"
                            aria-label="Open website"
                          >
                            <LinkIcon className="fill-muted-foreground" />
                            <span className="truncate">
                              {websiteEntity?.display_url || websiteHref}
                            </span>
                          </Link>
                        </li>
                      </>
                    )}
                    {/* Posts removed from stats row; now shown in header */}
                  </ul>

                  <footer
                    className="flex flex-wrap gap-x-2 gap-y-4 text-sm text-muted-foreground"
                    aria-label="Profile metadata"
                  >
                    {profile.location && (
                      <span className="flex items-center gap-1">
                        <LocationOnIcon className="fill-muted-foreground" />
                        {profile.location}
                      </span>
                    )}
                    {profile.created_at && (
                      <time
                        dateTime={profile.created_at}
                        className="flex items-center gap-1"
                      >
                        <EventIcon className="fill-muted-foreground" />
                        Joined{" "}
                        {format(new Date(profile.created_at), "MMMM yyyy")}
                      </time>
                    )}
                  </footer>
                </div>
              </section>
            ) : null}

            <div className="mt-2">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setTab(v as ProfileMode)}
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
                <TabsContent value="posts">
                  <div className="divide-y">
                    {(
                      (timelines.posts as import("@/features/threads/types").Tweet[]) ||
                      []
                    ).map((t) => (
                      <div key={t.id_str} className="px-4 py-2">
                        <Tweet
                          tweet={t}
                          characterLimit={280}
                          showThread={true}
                        />
                      </div>
                    ))}
                  </div>
                  {cursors.posts && (
                    <div className="p-4">
                      <Button
                        size="xs"
                        className="mx-auto block"
                        onClick={() => loadMore("posts")}
                      >
                        Load more
                      </Button>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="replies">
                  <div className="divide-y">
                    {(
                      (timelines.replies as import("@/features/threads/types").Tweet[]) ||
                      []
                    ).map((t) => (
                      <div key={t.id_str} className="px-4 py-2">
                        <Tweet
                          tweet={t}
                          characterLimit={280}
                          showThread={true}
                        />
                      </div>
                    ))}
                  </div>
                  {cursors.replies && (
                    <div className="p-4">
                      <Button
                        size="xs"
                        className="mx-auto block"
                        onClick={() => loadMore("replies")}
                      >
                        Load more
                      </Button>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="quotes">
                  <div className="divide-y">
                    {(
                      (timelines.quotes as import("@/features/threads/types").Tweet[]) ||
                      []
                    ).map((t) => (
                      <div key={t.id_str} className="px-4 py-2">
                        <Tweet
                          tweet={t}
                          characterLimit={280}
                          showThread={true}
                        />
                      </div>
                    ))}
                  </div>
                  {cursors.quotes && (
                    <div className="p-4">
                      <Button
                        size="xs"
                        className="mx-auto block"
                        onClick={() => loadMore("quotes")}
                      >
                        Load more
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
  if (isMobile) {
    return (
      <Drawer open onOpenChange={(o) => !o && closeProfile()}>
        <DrawerContent className="mt-0 flex h-[100dvh] max-h-[100dvh]">
          <div className="flex h-full w-full flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
  return panel;
}
