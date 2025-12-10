// features/agent/ui/ProspectResults.tsx
// Displays prospect search results using Tweet and LinkedInPostCard components

"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/shared/lib/utils";
import { Tweet, type TweetProps } from "@/features/webapp/ui/components/tweet/Tweet";
import {
  LinkedInPostCard,
  LinkedInPostCardSkeleton,
} from "@/features/webapp/ui/components/linkedin/LinkedInPostCard";
import type { Tweet as TweetType } from "@/features/threads/types";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Search, Users } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ProspectResultsProps {
  workspaceId: Id<"workspaces"> | null;
  className?: string;
}

interface Prospect {
  _id: Id<"prospects">;
  _creationTime: number;
  platform: "twitter" | "linkedin";
  externalId: string;
  data: unknown;
  matchScore?: number;
  matchReason?: string;
  matchedKeywords?: string[];
  status: "new" | "reviewed" | "contacted" | "converted" | "archived";
}

// ============================================================================
// Component
// ============================================================================

export function ProspectResults({ workspaceId, className }: ProspectResultsProps) {
  // Query prospects for the workspace
  const prospectsData = useQuery(
    api.prospects.getWorkspaceProspects,
    workspaceId ? { workspaceId, limit: 50 } : "skip"
  );

  const isLoading = workspaceId && prospectsData === undefined;
  const prospects = (prospectsData?.prospects ?? []) as Prospect[];
  const hasProspects = prospects.length > 0;

  // ============================================================================
  // Render States
  // ============================================================================

  // No workspace selected yet
  if (!workspaceId) {
    return (
      <div className={cn("flex h-full items-center justify-center p-8", className)}>
        <div className="text-center text-muted-foreground">
          <Users className="mx-auto mb-3 size-12 opacity-30" />
          <p className="text-sm">Complete setup to start finding prospects</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4 p-4", className)}>
        <LoadingSkeleton />
      </div>
    );
  }

  // Empty state
  if (!hasProspects) {
    return (
      <div className={cn("flex h-full items-center justify-center p-8", className)}>
        <div className="text-center text-muted-foreground">
          <Search className="mx-auto mb-3 size-12 opacity-30" />
          <p className="font-medium">No prospects yet</p>
          <p className="mt-1 text-sm">Start prospecting to find your ideal customers</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render Results
  // ============================================================================

  return (
    <div className={cn("space-y-4 overflow-y-auto p-4", className)}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {prospectsData?.total ?? prospects.length} prospects found
        </h2>
      </div>

      <div className="space-y-4">
        {prospects.map((prospect) => (
          <ProspectCard key={prospect._id} prospect={prospect} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Prospect Card
// ============================================================================

function ProspectCard({ prospect }: { prospect: Prospect }) {
  if (prospect.platform === "twitter") {
    return <TwitterProspectCard prospect={prospect} />;
  }
  return <LinkedInProspectCard prospect={prospect} />;
}

function TwitterProspectCard({ prospect }: { prospect: Prospect }) {
  // Transform prospect data to Tweet type
  const tweetData = prospect.data as TweetType;

  return (
    <div className="rounded-lg border bg-card p-4">
      {prospect.matchScore !== undefined && (
        <MatchBadge score={prospect.matchScore} reason={prospect.matchReason} />
      )}
      <Tweet
        tweet={tweetData}
        showFullContent={false}
        characterLimit={280}
        highlightQueries={prospect.matchedKeywords}
      />
    </div>
  );
}

function LinkedInProspectCard({ prospect }: { prospect: Prospect }) {
  // Transform prospect data to UnifiedPost type
  const postData = prospect.data as UnifiedPost;

  return (
    <div className="rounded-lg border bg-card p-4">
      {prospect.matchScore !== undefined && (
        <MatchBadge score={prospect.matchScore} reason={prospect.matchReason} />
      )}
      <LinkedInPostCard
        post={postData}
        showFullContent={false}
        characterLimit={300}
        highlightQueries={prospect.matchedKeywords}
      />
    </div>
  );
}

// ============================================================================
// Match Badge
// ============================================================================

function MatchBadge({ score, reason }: { score: number; reason?: string }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (s >= 60) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", getScoreColor(score))}>
        {score}% match
      </span>
      {reason && (
        <span className="truncate text-xs text-muted-foreground">{reason}</span>
      )}
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export default ProspectResults;
