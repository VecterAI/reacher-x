// app/(webapp)/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { Tweet } from "@/features/webapp/ui/components/tweet/Tweet";
import {
  LinkedInPostCard,
  LinkedInPostCardSkeleton,
} from "@/features/webapp/ui/components/linkedin/LinkedInPostCard";
import type { Tweet as TweetType } from "@/features/threads/types";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { Input } from "@/shared/ui/components/Input";
import { Button } from "@/shared/ui/components/Button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Search, Users } from "lucide-react";
import { FilterAltIcon, SwapVertIcon } from "@/shared/ui/components/icons";

// ============================================================================
// Types
// ============================================================================

type WorkspaceSetupStatus =
  | { status: "unauthenticated" }
  | { status: "no_user" }
  | { status: "no_workspace" }
  | {
      status: "needs_icp";
      workspace: {
        id: Id<"workspaces">;
        name: string;
        description: string;
        hasDescription: boolean;
      };
    }
  | {
      status: "complete";
      workspace: {
        id: Id<"workspaces">;
        name: string;
        description: string;
        icp: string[];
      };
    };

interface Prospect {
  _id: Id<"prospects">;
  _creationTime: number;
  platform: "twitter" | "linkedin";
  externalId: string;
  data: unknown;
  qualificationScore?: number;
  matchReason?: string;
  matchedKeywords?: string[];
  status: "new" | "reviewed" | "contacted" | "converted" | "archived";
}

type TabType = "review" | "contacted" | "in_progress";
type SortOption = "match" | "recent" | "engagement";
type PlatformFilter = "all" | "twitter" | "linkedin";

const TABS: { id: TabType; label: string; status: Prospect["status"][] }[] = [
  { id: "review", label: "Review", status: ["new"] },
  { id: "contacted", label: "Contacted", status: ["contacted"] },
  { id: "in_progress", label: "In progress", status: ["reviewed"] },
];

// ============================================================================
// Helpers
// ============================================================================

function isTweetData(data: unknown): data is TweetType {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id_str === "string" ||
    typeof obj.id === "string" ||
    typeof obj.full_text === "string" ||
    typeof obj.text === "string"
  );
}

/**
 * Type guard to check if data is a valid LinkedIn post structure.
 * LinkedIn raw data has different property names than UnifiedPost.
 */
function isLinkedInData(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  // Check for LinkedIn-specific fields
  return (
    typeof obj.postID === "string" ||
    typeof obj.urn === "string" ||
    typeof obj.text === "string" ||
    (typeof obj.author === "object" && obj.author !== null)
  );
}

/**
 * Normalize raw LinkedIn API data to UnifiedPost format.
 * The LinkedIn API returns profilePictureURL but UnifiedPost expects avatarUrl.
 */
function normalizeLinkedInData(data: unknown): UnifiedPost | null {
  if (!data || typeof data !== "object") return null;
  
  const raw = data as Record<string, unknown>;
  const author = raw.author as Record<string, unknown> | undefined;
  const postedAt = raw.postedAt as Record<string, unknown> | undefined;
  const engagements = raw.engagements as Record<string, unknown> | undefined;
  const mediaContent = raw.mediaContent as Array<Record<string, unknown>> | undefined;
  
  // Build UnifiedPost from raw LinkedIn data
  return {
    id: String(raw.postID ?? raw.urn ?? ""),
    platform: "linkedin",
    url: raw.postURL as string | undefined,
    author: {
      id: author?.id as string | undefined,
      handle: author?.urn as string | undefined,
      name: author?.name as string | undefined,
      // Map profilePictureURL to avatarUrl (the key fix!)
      avatarUrl: author?.profilePictureURL as string | undefined,
      profileUrl: author?.url as string | undefined,
      headline: author?.headline as string | undefined,
      type: author?.type as string | undefined,
    },
    text: String(raw.text ?? ""),
    createdAt: (postedAt?.timestamp as number) ?? Date.now(),
    metrics: {
      reactions: engagements?.totalReactions as number | undefined,
      comments: engagements?.commentsCount as number | undefined,
      reposts: engagements?.repostsCount as number | undefined,
    },
    media: Array.isArray(mediaContent)
      ? mediaContent.map((m) => ({
          type: (m.type === "article" ? "link" : m.type) as "image" | "video" | "link",
          url: m.url as string,
        }))
      : undefined,
    raw: data, // Preserve raw data for platform-specific features
  };
}

function getProspectText(prospect: Prospect): string {
  const data = prospect.data as Record<string, unknown>;
  return String(data.text ?? data.full_text ?? data.content ?? "");
}

function getEngagement(prospect: Prospect): number {
  const data = prospect.data as Record<string, unknown>;
  if (prospect.platform === "twitter") {
    return (
      Number(data.favorite_count ?? 0) +
      Number(data.retweet_count ?? 0) +
      Number(data.reply_count ?? 0)
    );
  }
  const engagements = data.engagements as Record<string, unknown> | undefined;
  return (
    Number(engagements?.totalReactions ?? 0) +
    Number(engagements?.commentsCount ?? 0)
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function ProspectsPage() {
  const router = useRouter();

  // Local state
  const [activeTab, setActiveTab] = useState<TabType>("review");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("match");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  // Queries
  const setupStatus = useQuery(api.workspaces.getWorkspaceSetupStatus) as
    | WorkspaceSetupStatus
    | undefined;

  const workspaceId =
    setupStatus?.status === "complete" ? setupStatus.workspace.id : null;

  const prospectsData = useQuery(
    api.prospects.getWorkspaceProspects,
    workspaceId ? { workspaceId, limit: 100 } : "skip"
  );

  // Redirect to agent if setup incomplete
  useEffect(() => {
    if (!setupStatus) return;
    if (
      setupStatus.status === "no_workspace" ||
      setupStatus.status === "needs_icp"
    ) {
      router.replace("/agent");
    }
  }, [setupStatus, router]);

  // Loading/redirect states
  if (
    setupStatus === undefined ||
    setupStatus.status === "no_workspace" ||
    setupStatus.status === "needs_icp"
  ) {
    return (
      <PageLayout>
        <PageHeader title="Prospects" />
        <PageContent className="p-4">
          <ProspectsToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <div className="mt-4 space-y-4">
            <Tweet tweet={{} as TweetType} loading />
            <LinkedInPostCardSkeleton />
            <Tweet tweet={{} as TweetType} loading />
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  const isLoading = workspaceId && prospectsData === undefined;
  const allProspects = (prospectsData?.prospects ?? []) as Prospect[];
  const activeStatuses = TABS.find((t) => t.id === activeTab)?.status ?? ["new"];

  // Filter & sort
  const filteredProspects = allProspects.filter((p) => {
    if (!activeStatuses.includes(p.status)) return false;
    if (platformFilter !== "all" && p.platform !== platformFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const keywords = p.matchedKeywords?.join(" ").toLowerCase() ?? "";
      const text = getProspectText(p).toLowerCase();
      if (!keywords.includes(query) && !text.includes(query)) return false;
    }
    return true;
  });

  const sortedProspects = [...filteredProspects].sort((a, b) => {
    if (sortBy === "match") return (b.qualificationScore ?? 0) - (a.qualificationScore ?? 0);
    if (sortBy === "recent") return b._creationTime - a._creationTime;
    return getEngagement(b) - getEngagement(a);
  });

  // Empty state
  if (!isLoading && allProspects.length === 0) {
    return (
      <PageLayout>
        <PageHeader title="Prospects" />
        <PageContent className="flex h-full items-center justify-center p-8">
          <div className="text-muted-foreground text-center">
            <Users className="mx-auto mb-3 size-12 opacity-30" />
            <p className="font-medium">No prospects yet</p>
            <p className="mt-1 text-sm">
              Start prospecting to find your ideal customers
            </p>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader title="Prospects" />
      <PageContent className="flex h-full flex-col p-0">
        <ProspectsToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="px-4 pt-4"
        />

        <ScrollArea className="flex-1 px-4">
          {isLoading ? (
            <div className="space-y-4 py-4">
              <Tweet tweet={{} as TweetType} loading />
              <LinkedInPostCardSkeleton />
              <Tweet tweet={{} as TweetType} loading />
            </div>
          ) : sortedProspects.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No prospects in this category
            </p>
          ) : (
            <ul >
              {sortedProspects.map((prospect) => (
                <li key={prospect._id} >
                  {prospect.platform === "twitter" ? (
                    isTweetData(prospect.data) ? (
                      <Tweet
                        tweet={prospect.data}
                        showFullContent={false}
                        characterLimit={280}
                        highlightQueries={prospect.matchedKeywords}
                      />
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Unable to display tweet
                      </p>
                    )
                  ) : isLinkedInData(prospect.data) ? (
                    (() => {
                      const normalizedPost = normalizeLinkedInData(prospect.data);
                      return normalizedPost ? (
                        <LinkedInPostCard
                          post={normalizedPost}
                          showFullContent={false}
                          characterLimit={300}
                          highlightQueries={prospect.matchedKeywords}
                        />
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          Unable to display LinkedIn post
                        </p>
                      );
                    })()
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Unable to display LinkedIn post
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PageContent>
    </PageLayout>
  );
}

// ============================================================================
// Toolbar Component
// ============================================================================

interface ProspectsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  className?: string;
}

function ProspectsToolbar({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  className,
}: ProspectsToolbarProps) {
  return (
    <div className={className}>
      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Search..."
          size="sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs + Filter/Sort */}
      <nav className="mt-3 flex items-center justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(v) => onTabChange(v as TabType)}
        >
          <TabsList size="sm">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} size="sm">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="xs">
            <FilterAltIcon className="mr-1.5 h-4 w-4 fill-current" />
            Filter
          </Button>
          <Button variant="outline" size="xsIcon">
            <SwapVertIcon className="h-4 w-4 fill-current" />
          </Button>
        </div>
      </nav>
    </div>
  );
}
