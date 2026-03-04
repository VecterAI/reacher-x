/**
 * ProspectProfilePanel
 * Main profile panel displaying enriched prospect details.
 * Can be rendered as a side panel or full page.
 * Uses panel stack for navigation to sub-panels.
 */
"use client";

import * as React from "react";
import { cn, parseText } from "@/shared/lib/utils";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/components/Tabs";
import { Separator } from "@/shared/ui/components/Separator";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Button } from "@/shared/ui/components/Button";
import { usePanelStack } from "../../contexts/PanelStackContext";
import { ProspectProfileHeader } from "./ProspectProfileHeader";
import { PipelineTimeline, type PipelineStage } from "./PipelineTimeline";
import { ProspectDetailsCard } from "./ProspectDetailsCard";
import { PainSolutionGrid, type PainPoint } from "./PainSolutionGrid";
import { SocialProfileLinks, type SocialProfiles } from "./SocialProfileLinks";
import { RelevantActivityTab } from "./tabs/RelevantActivityTab";
import { YourInteractionsTab } from "./tabs/YourInteractionsTab";
import { ActivityLogTab } from "./tabs/ActivityLogTab";
import { OutreachPlanSection } from "./OutreachPlanSection";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { Drawer, DrawerContent } from "@/shared/ui/components/Drawer";

export interface ProspectProfileData {
  id: string;
  displayName?: string;
  title?: string;
  avatarUrl?: string;
  profileUrl?: string;
  platform?: "twitter" | "linkedin";
  prospectType?: "individual" | "organization" | "unknown";
  briefIntro?: string;
  pipelineStage?: PipelineStage;
  stageTimestamps?: Partial<Record<PipelineStage, number>>;
  qualificationScore?: number;
  status?: "new" | "contacted" | "in_progress" | "converted" | "archived";
  company?: string;
  websiteUrl?: string;
  email?: string;
  finance?: {
    displayValue: string;
    evidencePosts?: unknown[];
  };
  location?: string;
  evidencePosts?: unknown[];
  painPoints?: PainPoint[];
  socialProfiles?: SocialProfiles;
  updatedAt?: number;
}

export interface ProspectProfilePanelProps {
  /** Prospect data to display */
  prospect?: ProspectProfileData;
  /** Loading state */
  loading?: boolean;
  /** Handler for Chat with Agent button */
  onChatWithAgent?: () => void;
  /** Handler for back button (defaults to popPanel) */
  onBack?: () => void;
  /** Additional className */
  className?: string;
  /** Disable mobile drawer wrap (for dedicated page) */
  disableMobileDrawer?: boolean;
}

type ProfileTab =
  | "overview"
  | "relevant-activity"
  | "interactions"
  | "activity-log";

export function ProspectProfilePanel({
  prospect,
  loading = false,
  onChatWithAgent,
  onBack,
  className,
  disableMobileDrawer = false,
}: ProspectProfilePanelProps) {
  const { popPanel, pushPanel, currentPanel } = usePanelStack();
  const [activeTab, setActiveTab] = React.useState<ProfileTab>("overview");
  const [showFullIntro, setShowFullIntro] = React.useState(false);
  const isMobile = useIsMobile();

  // Handle pain point click - push evidence panel
  const handlePainClick = (painPoint: PainPoint) => {
    pushPanel("evidence-posts", {
      title: "Posts",
      posts: painPoint.evidencePosts || [],
      platform: prospect?.platform || "twitter",
    });
  };

  // Handle finance click - push evidence panel
  const handleFinanceClick = () => {
    if (prospect?.finance?.evidencePosts) {
      pushPanel("evidence-posts", {
        title: "Posts",
        posts: prospect.finance.evidencePosts,
        platform: prospect.platform || "linkedin",
      });
    }
  };

  // Handle Twitter button - push Twitter profile panel
  const handleTwitterClick = (username: string) => {
    pushPanel("twitter-profile", { username });
  };

  // Close handler - use onBack if provided, otherwise popPanel
  const handleClose = () => {
    if (onBack) {
      onBack();
    } else {
      popPanel();
    }
  };

  const relevantActivityPosts = React.useMemo(() => {
    if (!prospect) return [];

    return dedupePostsById([
      ...(prospect.evidencePosts || []),
      ...(prospect.painPoints?.flatMap((pp) => pp.evidencePosts || []) || []),
      ...(prospect.finance?.evidencePosts || []),
    ]);
  }, [prospect]);

  const panel = (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="md:w-full">
        <PageHeader title="Profile" onBack={handleClose} />
        <ScrollArea
          className="prospect-profile-scrollarea h-[calc(100dvh-3rem)]"
          viewportClassName="pb-8"
        >
          <PageContent>
            {loading ? (
              <ProfileSkeleton />
            ) : prospect ? (
              <div>
                {/* Header */}
                <ProspectProfileHeader
                  prospectId={prospect.id}
                  status={prospect.status}
                  name={prospect.displayName}
                  title={prospect.title}
                  avatarUrl={prospect.avatarUrl}
                  profileUrl={prospect.profileUrl}
                  platform={prospect.platform}
                  prospectType={prospect.prospectType}
                  timestamp={prospect.updatedAt}
                  onChatWithAgent={onChatWithAgent}
                />

                {/* Outreach Plan Section - directly under header */}
                <section className="px-4 pb-4">
                  <OutreachPlanSection prospectId={prospect.id} />
                </section>

                <Separator orientation="horizontal" className="my-0" />

                {/* Tabs */}
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as ProfileTab)}
                >
                  {/* Scrollable tabs container */}
                  <div className="border-border relative border-b">
                    {/* Gradient overlays for scroll indication */}
                    <div
                      className="from-background pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-linear-to-r to-transparent"
                      aria-hidden="true"
                    />
                    <div
                      className="from-background pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-linear-to-l to-transparent"
                      aria-hidden="true"
                    />
                    <div className="scrollbar-none overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden">
                      <TabsList variant="underline">
                        <TabsTrigger value="overview" variant="underline">
                          Overview
                        </TabsTrigger>
                        <TabsTrigger
                          value="relevant-activity"
                          variant="underline"
                        >
                          Relevant activity
                        </TabsTrigger>
                        <TabsTrigger value="interactions" variant="underline">
                          Your interactions
                        </TabsTrigger>
                        <TabsTrigger value="activity-log" variant="underline">
                          Activity log
                        </TabsTrigger>
                      </TabsList>
                    </div>
                  </div>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="mt-0">
                    {/* Brief Intro */}
                    {prospect.briefIntro && (
                      <section className="space-y-2 p-4">
                        <h3 className="text-sm font-medium">Brief intro</h3>
                        <p
                          className={cn(
                            "text-foreground [&_a]:text-muted-foreground text-sm whitespace-pre-line [&_a]:hover:underline",
                            !showFullIntro && "line-clamp-3"
                          )}
                        >
                          {parseText(prospect.briefIntro)}
                        </p>
                        {prospect.briefIntro.length > 150 && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setShowFullIntro((prev) => !prev)}
                          >
                            {showFullIntro ? "Show less" : "Show more"}
                          </Button>
                        )}
                      </section>
                    )}

                    <Separator orientation="horizontal" className="my-0" />

                    {/* Pipeline Timeline */}
                    <section className="px-4 pt-4">
                      <PipelineTimeline
                        currentStage={prospect.pipelineStage || "new"}
                        stageTimestamps={prospect.stageTimestamps}
                      />
                    </section>

                    <Separator orientation="horizontal" className="my-0" />

                    {/* Details */}
                    <section className="px-4 py-4">
                      <ProspectDetailsCard
                        qualificationScore={prospect.qualificationScore}
                        status={prospect.status}
                        company={prospect.company}
                        websiteUrl={prospect.websiteUrl}
                        email={prospect.email}
                        finance={prospect.finance?.displayValue}
                        location={prospect.location}
                        onFinanceClick={handleFinanceClick}
                      />
                    </section>

                    <Separator orientation="horizontal" className="my-0" />

                    {/* Pain Points / Solutions */}
                    {prospect.painPoints && prospect.painPoints.length > 0 && (
                      <section className="px-4 py-4">
                        <PainSolutionGrid
                          painPoints={prospect.painPoints}
                          onPainClick={handlePainClick}
                        />
                      </section>
                    )}

                    <Separator orientation="horizontal" className="my-0" />

                    {/* Social Profiles */}
                    <section className="px-4 py-4">
                      <SocialProfileLinks
                        profiles={prospect.socialProfiles}
                        onTwitterClick={handleTwitterClick}
                      />
                    </section>
                  </TabsContent>

                  {/* Relevant Activity Tab */}
                  <TabsContent value="relevant-activity" className="mt-0">
                    <RelevantActivityTab
                      prospectId={prospect.id}
                      platform={prospect.platform || "twitter"}
                      evidencePosts={relevantActivityPosts}
                    />
                  </TabsContent>

                  {/* Your Interactions Tab */}
                  <TabsContent value="interactions" className="mt-0">
                    <YourInteractionsTab
                      prospectId={prospect.id}
                      platform={prospect.platform || "twitter"}
                    />
                  </TabsContent>

                  {/* Activity Log Tab */}
                  <TabsContent value="activity-log" className="mt-0">
                    <ActivityLogTab
                      prospectId={prospect.id}
                      prospectName={prospect.displayName}
                      prospectAvatarUrl={prospect.avatarUrl}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No prospect selected.
              </div>
            )}
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );

  if (isMobile && !disableMobileDrawer) {
    return (
      <Drawer open onOpenChange={(o) => !o && handleClose()}>
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

function dedupePostsById(posts: unknown[]): unknown[] {
  const seen = new Set<string>();

  return posts.filter((post) => {
    const postId = getPostId(post);
    if (!postId) return true;
    if (seen.has(postId)) return false;
    seen.add(postId);
    return true;
  });
}

function getPostId(post: unknown): string | null {
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

/** Loading skeleton for the profile panel */
function ProfileSkeleton() {
  return (
    <div className="space-y-0">
      {/* Header skeleton */}
      <div className="flex flex-wrap items-start gap-3 px-4 py-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-24 rounded" />
        </div>
      </div>

      {/* Outreach Plan Section skeleton */}
      <section className="px-4 py-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16 rounded" />
              <Skeleton className="h-8 w-20 rounded" />
            </div>
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
          </div>
        </div>
      </section>

      <Separator orientation="horizontal" className="my-0" />

      {/* Tabs skeleton */}
      <div className="border-border relative border-b">
        <div className="scrollbar-none overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex items-center gap-1">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </div>

      {/* Overview Tab Content skeleton */}
      <div className="space-y-0">
        {/* Brief intro skeleton */}
        <section className="space-y-2 p-4">
          <Skeleton className="h-4 w-20" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-4 w-16" />
        </section>

        <Separator orientation="horizontal" className="my-0" />

        {/* Pipeline Timeline skeleton */}
        <section className="px-4 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-1">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
          <div className="flex gap-4 pb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex min-w-[100px] flex-col items-center gap-2"
              >
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </section>

        <Separator orientation="horizontal" className="my-0" />

        {/* Details Card skeleton */}
        <section className="px-4 py-4">
          <div className="space-y-1">
            {/* Fit row */}
            <div className="flex items-center gap-3 py-1.5">
              <div className="flex w-28 shrink-0 items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-8" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-10" />
              </div>
            </div>
            {/* Status row */}
            <div className="flex items-center gap-3 py-1.5">
              <div className="flex w-28 shrink-0 items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            {/* Company row */}
            <div className="flex items-center gap-3 py-1.5">
              <div className="flex w-28 shrink-0 items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-4 w-32" />
            </div>
            {/* Website row */}
            <div className="flex items-center gap-3 py-1.5">
              <div className="flex w-28 shrink-0 items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-40" />
            </div>
            {/* Show more button */}
            <Skeleton className="mt-2 h-8 w-24 rounded" />
          </div>
        </section>

        <Separator orientation="horizontal" className="my-0" />

        {/* Pain Solution Grid skeleton */}
        <section className="px-4 py-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative pl-3">
                <Skeleton className="absolute top-0 left-0 h-full w-1" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="relative pl-3">
                <Skeleton className="absolute top-0 left-0 h-full w-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            {/* Rows */}
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="grid grid-cols-2 gap-4">
                  <div className="relative pl-3">
                    <Skeleton className="absolute top-0 left-0 h-full w-1" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                  <div className="relative pl-3">
                    <Skeleton className="absolute top-0 left-0 h-full w-1" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              ))}
            </div>
            {/* Show more button */}
            <Skeleton className="h-8 w-full rounded" />
          </div>
        </section>

        <Separator orientation="horizontal" className="my-0" />

        {/* Social Profiles skeleton */}
        <section className="px-4 py-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded" />
              <Skeleton className="h-8 w-24 rounded" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
