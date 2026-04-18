"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageContent } from "@/features/webapp/ui/components/page/PageContent";
import { PageHeader } from "@/features/webapp/ui/components/page/PageHeader";
import { PageLayout } from "@/features/webapp/ui/components/page/PageLayout";
import { LinkedInPostCard } from "@/features/webapp/ui/components/linkedin";
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
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { cn, formatLargeNumber } from "@/shared/lib/utils";
import type { LinkedInProfileData } from "../../lib/uiPreviewData";
import type { UnifiedPost } from "@/shared/lib/platforms/types";

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface LinkedInProfilePanelProps {
  profile: LinkedInProfileData;
  className?: string;
  onBack?: () => void;
  onOpenCommentComposer?: (post: UnifiedPost) => void;
  onOpenConversation?: () => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function LinkedInProfilePanel({
  profile,
  className,
  onBack,
  onOpenCommentComposer,
  onOpenConversation,
  loading,
  error,
  onRetry,
}: LinkedInProfilePanelProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = React.useState("posts");

  const profileUrl =
    profile?.profileUrl ||
    (profile?.username
      ? `https://linkedin.com/in/${profile.username}`
      : undefined);

  const currentPosition = profile?.positions?.find((p) => p.isCurrent);

  const primaryWebsite =
    profile?.contact?.websites?.[0] ||
    (profile?.currentCompany?.website
      ? { url: profile.currentCompany.website, category: "COMPANY" }
      : undefined);

  const connectionLabel =
    profile?.connectionStatus === "connected"
      ? "Remove connection"
      : profile?.connectionStatus === "pending"
        ? "Pending"
        : "Connect";

  const followerParts = getAnimatedParts(profile?.followerCount ?? 0);
  const connectionParts = getAnimatedParts(profile?.connectionCount ?? 0);

  // -----------------------------------------------------------------------
  // Loading skeleton
  // -----------------------------------------------------------------------
  const loadingSkeleton = (
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
  );

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
            {onRetry ? (
              <Button size="xs" onClick={() => void onRetry()}>
                Retry
              </Button>
            ) : null}
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
  const profileHeader = profile ? (
    <section className="border-b pb-4" aria-label="Profile summary">
      {/* Banner */}
      {profile.backgroundImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.backgroundImageUrl}
          alt={`${profile.displayName} banner`}
          className="h-44 w-full border-b object-cover"
        />
      ) : (
        <div className="bg-muted h-44 w-full border-b" aria-hidden="true" />
      )}

      <div className="mx-4 -mt-7 space-y-3">
        {/* Avatar */}
        <header className="space-y-3">
          <Avatar className="ring-border ring-offset-background size-12 ring-1 ring-offset-2">
            {profile.profilePictureUrl ? (
              <AvatarImage
                src={profile.profilePictureUrl}
                alt={profile.displayName}
              />
            ) : null}
            <AvatarFallback>
              {profile.firstName?.charAt(0).toUpperCase() || "?"}
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
                    title={profile.displayName}
                  >
                    {profile.displayName}
                  </Link>
                ) : (
                  <span className="text-sm font-medium">
                    {profile.displayName}
                  </span>
                )}
                {profile.isPremium ? (
                  <NewReleasesIcon
                    className="size-3.5 shrink-0 fill-current"
                    aria-hidden="true"
                  />
                ) : null}
              </div>

              {/* Action buttons */}
              <div className="flex shrink-0 items-center gap-1">
                {/* Connect / Pending / Remove */}
                <Button
                  size="xs"
                  variant={
                    profile.connectionStatus === "connected"
                      ? "outline"
                      : "default"
                  }
                  disabled={profile.connectionStatus === "pending"}
                >
                  {connectionLabel}
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
                    {profile.contact?.emailAddress ? (
                      <DropdownMenuItem
                        onClick={() =>
                          navigator.clipboard
                            .writeText(profile.contact!.emailAddress!)
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
            {profile.headline ? (
              <p className="text-muted-foreground line-clamp-2 text-sm">
                {profile.headline}
              </p>
            ) : null}
            {profile.location ? (
              <p className="text-muted-foreground text-xs">
                {profile.location}
              </p>
            ) : null}
          </div>
        </header>

        {/* Summary / About */}
        {profile.summary ? (
          <p className="text-sm whitespace-pre-line">{profile.summary}</p>
        ) : null}

        {/* Stats strip: connections · followers · company · website */}
        {(() => {
          const items: React.ReactNode[] = [];
          if ((profile.connectionCount ?? 0) > 0) {
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
          if ((profile.followerCount ?? 0) > 0) {
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
                <React.Fragment key={idx}>
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
  const postsTab = (
    <TabsContent value="posts">
      <div className="divide-y">
        {profile?.recentPosts?.length > 0
          ? profile.recentPosts.map((post) => (
              <div key={post.id} className="px-4 py-2">
                <LinkedInPostCard
                  post={post}
                  characterLimit={300}
                  readOnly={!onOpenCommentComposer}
                  showMenu={false}
                  previewMode={Boolean(onOpenCommentComposer)}
                  onPreviewComment={onOpenCommentComposer}
                />
              </div>
            ))
          : null}

        {!profile?.recentPosts || profile.recentPosts.length === 0 ? (
          <div className="text-muted-foreground px-4 py-8 text-sm">
            No posts found.
          </div>
        ) : null}
      </div>
    </TabsContent>
  );

  // -----------------------------------------------------------------------
  // About tab
  // -----------------------------------------------------------------------
  const aboutTab = (
    <TabsContent value="about">
      {/* Experience */}
      {profile?.positions?.length > 0 ? (
        <section className="pt-3 pb-1">
          <h3 className="px-4 text-sm font-medium">Experience</h3>
          <div className="mt-1 divide-y">
            {groupPositionsByCompany(profile.positions).map((group) =>
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
                      <p className="mt-1.5 text-sm">
                        {group.positions[0].description}
                      </p>
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
                      <div key={`${pos.title}-${i}`} className="flex gap-3">
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
                            <p className="mt-1 text-sm">{pos.description}</p>
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
      {profile?.education?.length > 0 ? (
        <section className="border-t pt-3 pb-1">
          <h3 className="px-4 text-sm font-medium">Education</h3>
          <div className="mt-1 divide-y">
            {profile.education.map((edu, i) => (
              <div key={`${edu.school}-${i}`} className="flex gap-3 px-4 py-3">
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
      {profile?.skills?.length > 0 ? (
        <section className="border-t pt-3 pb-3">
          <h3 className="px-4 text-sm font-medium">Skills</h3>
          <div className="mt-2 flex flex-wrap gap-1.5 px-4">
            {profile.skills.slice(0, 12).map((skill) => (
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
      {profile?.featuredPosts && profile.featuredPosts.length > 0 ? (
        <section className="border-t pt-3 pb-1">
          <h3 className="px-4 text-sm font-medium">Featured</h3>
          <div className="divide-y">
            {profile.featuredPosts.map((item, i) => (
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
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
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
      {profile?.contact &&
      (profile.contact.emailAddress ||
        (profile.contact.websites?.length ?? 0) > 0) ? (
        <section className="border-t pt-3 pb-3">
          <h3 className="px-4 text-sm font-medium">Contact</h3>
          <div className="mt-2 space-y-2 px-4 text-sm">
            {profile.contact.emailAddress ? (
              <p className="flex items-center gap-2">
                <AlternateEmailIcon className="fill-muted-foreground shrink-0" />
                <span className="truncate font-mono">
                  {profile.contact.emailAddress}
                </span>
              </p>
            ) : null}
            {profile.contact.websites?.map((site) => (
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
      {profile?.languages && profile.languages.length > 0 ? (
        <section className="border-t pt-3 pb-3">
          <h3 className="px-4 text-sm font-medium">Languages</h3>
          <div className="mt-2 space-y-1.5 px-4 text-sm">
            {profile.languages.map((lang) => (
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
      {profile?.currentCompany ? (
        <section className="border-t pt-3 pb-3">
          <h3 className="px-4 text-sm font-medium">Company</h3>
          <div className="mt-2 space-y-2 px-4 text-sm">
            <div className="flex items-start gap-3">
              <Avatar className="size-10 shrink-0 rounded-md">
                {profile.currentCompany.logoUrl ? (
                  <AvatarImage
                    src={profile.currentCompany.logoUrl}
                    alt={profile.currentCompany.name}
                    className="object-contain"
                  />
                ) : null}
                <AvatarFallback className="rounded-md">
                  {profile.currentCompany.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium">{profile.currentCompany.name}</p>
                {profile.currentCompany.industry ||
                profile.currentCompany.staffCount != null ||
                profile.currentCompany.founded ? (
                  <p className="text-muted-foreground text-xs">
                    {[
                      profile.currentCompany.industry,
                      profile.currentCompany.staffCount != null
                        ? `${profile.currentCompany.staffCount} employees`
                        : undefined,
                      profile.currentCompany.founded
                        ? `Founded ${profile.currentCompany.founded}`
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(" \u00B7 ")}
                  </p>
                ) : null}
              </div>
            </div>
            {profile.currentCompany.description ? (
              <p className="text-muted-foreground line-clamp-3">
                {profile.currentCompany.description}
              </p>
            ) : null}
            {profile.currentCompany.website ? (
              <p className="flex items-center gap-1">
                <LinkIcon className="fill-muted-foreground shrink-0" />
                <Link
                  href={profile.currentCompany.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground font-mono hover:underline"
                >
                  {safeHostname(profile.currentCompany.website)}
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
            {loading ? loadingSkeleton : null}

            {error && !profile ? errorState : null}

            {!loading && profile ? (
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
            <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return panel;
}
