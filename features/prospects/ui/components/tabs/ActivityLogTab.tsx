"use client";

/**
 * ActivityLogTab
 * Displays the activity timeline for a prospect.
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineHeader,
  TimelineIndicator,
  TimelineTitle,
  TimelineContent,
} from "@/shared/ui/components/Timeline";
import { formatRelativeTime } from "@/shared/lib/utils";

const ACTIVITY_ICONS: Record<string, string> = {
  found: "🔍",
  enriched: "✨",
  plan_created: "📋",
  contacted: "💬",
  responded: "↩️",
  converted: "🎉",
  archived: "📦",
};

export interface ActivityLogTabProps {
  prospectId: string;
}

export function ActivityLogTab({ prospectId }: ActivityLogTabProps) {
  const activities = useQuery(api.outreach.getActivityLog, {
    prospectId: prospectId as Id<"prospects">,
  });

  if (activities === undefined) {
    return <ActivityLogSkeleton />;
  }

  if (activities.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <Timeline>
        {activities.map((activity, index) => (
          <TimelineItem key={activity._id} step={index + 1}>
            <TimelineSeparator />
            <TimelineIndicator>
              <span className="text-[10px]">
                {ACTIVITY_ICONS[activity.type] || "•"}
              </span>
            </TimelineIndicator>
            <TimelineHeader>
              <TimelineTitle>{activity.title}</TimelineTitle>
            </TimelineHeader>
            <TimelineContent>
              {activity.description && (
                <p className="text-muted-foreground text-sm">
                  {activity.description}
                </p>
              )}
              <time
                dateTime={new Date(activity._creationTime).toISOString()}
                className="text-muted-foreground mt-1 text-xs"
              >
                {formatRelativeTime(
                  new Date(activity._creationTime).toISOString()
                )}
              </time>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  );
}

function ActivityLogSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
