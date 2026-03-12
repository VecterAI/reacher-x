"use client";

/**
 * NotificationsPage
 * Displays user notifications grouped by Today/Yesterday/Older.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/shared/lib/utils";
import {
  useActiveUseCaseLabels,
  useAuth,
  useQueryWithStatus,
} from "@/shared/hooks";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/components/Tabs";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { formatRelativeTime, parseText } from "@/shared/lib/utils";
import { HelpCircle, CheckCircle } from "lucide-react";
import {
  FramePersonIcon,
  NotificationsIcon,
  QuickPhrasesIcon,
} from "@/shared/ui/components/icons";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";

// ============================================================================
// Types
// ============================================================================

type Notification = Doc<"outreachNotifications">;

interface NotificationGroup {
  today: Notification[];
  yesterday: Notification[];
  older: Notification[];
}

// ============================================================================
// Helpers
// ============================================================================

function groupNotificationsByDay(
  notifications: Notification[]
): NotificationGroup {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const groups: NotificationGroup = {
    today: [],
    yesterday: [],
    older: [],
  };

  for (const notification of notifications) {
    const createdDate = new Date(notification._creationTime);
    if (createdDate >= today) {
      groups.today.push(notification);
    } else if (createdDate >= yesterday) {
      groups.yesterday.push(notification);
    } else {
      groups.older.push(notification);
    }
  }

  return groups;
}

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "prospects_found":
      return <FramePersonIcon className="fill-current" />;
    case "outreach_sent":
      return <NotificationsIcon className="fill-current" />;
    case "prospect_replied":
      return <QuickPhrasesIcon className="fill-current" />;
    case "ask_human":
      return <HelpCircle className="size-4" />;
    case "plan_completed":
      return <CheckCircle className="size-4" />;
    default:
      return <NotificationsIcon className="fill-current" />;
  }
}

// ============================================================================
// NotificationCard Component
// ============================================================================

interface NotificationCardProps {
  notification: Notification;
  onSelect: () => void;
  onDismiss: () => void;
}

function NotificationCard({
  notification,
  onSelect,
  onDismiss: _onDismiss,
}: NotificationCardProps) {
  const router = useRouter();
  const { entitySingular, routes } = useActiveUseCaseLabels();
  const [isHovered, setIsHovered] = React.useState(false);
  const timeAgo = formatRelativeTime(
    new Date(notification._creationTime).toISOString()
  );

  const isPending = notification.status === "pending";
  // Show avatar when there's prospect data available (avatar URL or display name)
  const showAvatar = Boolean(
    notification.prospectAvatarUrl || notification.prospectDisplayName
  );

  // Determine avatar shape based on prospect type
  // Per ProspectCardHeader: rounded-lg for organizations with ring-border ring-1
  const avatarShape =
    notification.prospectType === "organization"
      ? "rounded-lg"
      : "rounded-full";

  // Parse message for mentions, hashtags, links (like TweetBody/ProspectCardBody)
  const parsedMessage = parseText(notification.message);

  return (
    <article
      className={cn(
        "group border-border flex cursor-pointer items-start gap-3 border-b p-4"
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar or Icon with dot indicator */}
      <div className="relative shrink-0">
        {showAvatar ? (
          <Avatar className={cn("ring-border size-8 ring-1", avatarShape)}>
            <AvatarImage
              src={notification.prospectAvatarUrl}
              alt={notification.prospectDisplayName || entitySingular}
            />
            <AvatarFallback className={avatarShape}>
              {notification.prospectDisplayName?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="bg-secondary flex size-8 items-center justify-center rounded-md">
            {getNotificationIcon(notification.type)}
          </div>
        )}

        {/* Static dot for pending notifications - no animation */}
        {isPending && (
          <span
            className="border-background bg-foreground absolute -top-0.5 -right-0.5 size-3 rounded-full border-2"
            aria-label="Pending notification"
          />
        )}

        {/* Reply count badge with AnimatedNumber - only animates on hover */}
        {notification.replyCount && notification.replyCount > 0 && (
          <Badge
            variant="secondary"
            className="border-background absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center border px-1 text-[10px]"
          >
            <AnimatedNumber
              value={
                isHovered ? notification.replyCount : notification.replyCount
              }
              animateOnMount={false}
            />
          </Badge>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {/* Title with clickable bold prospect name */}
        <p className="text-foreground text-sm font-medium">
          {notification.prospectDisplayName && notification.prospectId ? (
            // Split title to wrap prospect name in clickable button
            <>
              {notification.title.split(notification.prospectDisplayName)[0]}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!notification.prospectId) return;
                  router.push(routes.detailHref(notification.prospectId));
                }}
                className="font-bold hover:underline"
              >
                {notification.prospectDisplayName}
              </button>
              {notification.title.split(notification.prospectDisplayName)[1]}
            </>
          ) : (
            <span>{notification.title}</span>
          )}
        </p>
        {/* Parsed message body with mentions, hashtags, links */}
        <p className="[&_a]:text-muted-foreground text-muted-foreground mt-0.5 line-clamp-2 text-sm whitespace-pre-line [&_a]:hover:underline">
          {parsedMessage}
        </p>
        <time
          dateTime={new Date(notification._creationTime).toISOString()}
          className="text-muted-foreground mt-1 text-sm"
        >
          {timeAgo}
        </time>
      </div>
    </article>
  );
}

// ============================================================================
// NotificationsList Component
// ============================================================================

interface NotificationsListProps {
  notifications: Notification[];
  onSelect: (notification: Notification) => void;
  onDismiss: (notificationId: Id<"outreachNotifications">) => void;
}

function NotificationsList({
  notifications,
  onSelect,
  onDismiss,
}: NotificationsListProps) {
  if (notifications.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No notifications
      </p>
    );
  }

  return (
    <div>
      {notifications.map((notification) => (
        <NotificationCard
          key={notification._id}
          notification={notification}
          onSelect={() => onSelect(notification)}
          onDismiss={() => onDismiss(notification._id)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// NotificationsSkeleton Component
// ============================================================================

function NotificationsSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-3">
          <Skeleton className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, workspace, error: authError } = useAuth();

  // Fetch notifications
  const notificationsQuery = useQueryWithStatus(
    api.outreach.listNotifications,
    isAuthenticated ? {} : "skip"
  );
  const notifications = notificationsQuery.data;
  const markSeen = useMutation(api.outreach.markNotificationSeen);
  const dismissNotification = useMutation(api.outreach.dismissNotification);

  const isLoading =
    isAuthenticated &&
    (workspace === undefined || notificationsQuery.isPending);

  // Group notifications by day
  const groups = React.useMemo(() => {
    if (!notifications) return { today: [], yesterday: [], older: [] };
    return groupNotificationsByDay(notifications);
  }, [notifications]);

  // Handle notification click
  const handleSelect = async (notification: Notification) => {
    // Mark as seen
    if (notification.status === "pending") {
      await markSeen({ notificationId: notification._id });
    }

    // Route to appropriate destination
    if (notification.prospectId) {
      // Build query params
      const params = new URLSearchParams();
      params.set("prospectId", notification.prospectId);

      // Include threadId if available
      if (notification.threadId) {
        params.set("threadId", notification.threadId);
      }

      // Deterministic approval panel deep-link context.
      if (notification.taskId) {
        params.set("taskId", notification.taskId);
        params.set("panel", "approval");
      }

      router.push(`/agent?${params.toString()}`);
    }
  };

  const handleDismiss = async (notificationId: Id<"outreachNotifications">) => {
    await dismissNotification({ notificationId });
  };

  return (
    <PageLayout>
      <PageHeader title="Notifications" onBack={() => router.back()} />
      <PageContent className="pt-4">
        {(authError || notificationsQuery.isError) && (
          <div className="mx-4 mb-4 rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">Could not load notifications</p>
            <p className="text-muted-foreground mt-1">
              {authError?.message ||
                notificationsQuery.error?.message ||
                "Please try again."}
            </p>
            <Button
              size="xs"
              variant="outline"
              className="mt-3"
              onClick={() => router.refresh()}
            >
              Retry
            </Button>
          </div>
        )}
        <Tabs defaultValue="today">
          <TabsList size="sm" className="mx-4">
            <TabsTrigger value="today" size="sm">
              Today {groups.today.length > 0 && `(${groups.today.length})`}
            </TabsTrigger>
            <TabsTrigger value="yesterday" size="sm">
              Yesterday{" "}
              {groups.yesterday.length > 0 && `(${groups.yesterday.length})`}
            </TabsTrigger>
            <TabsTrigger value="older" size="sm">
              Older {groups.older.length > 0 && `(${groups.older.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            {isLoading ? (
              <NotificationsSkeleton />
            ) : (
              <NotificationsList
                notifications={groups.today}
                onSelect={handleSelect}
                onDismiss={handleDismiss}
              />
            )}
          </TabsContent>

          <TabsContent value="yesterday">
            {isLoading ? (
              <NotificationsSkeleton />
            ) : (
              <NotificationsList
                notifications={groups.yesterday}
                onSelect={handleSelect}
                onDismiss={handleDismiss}
              />
            )}
          </TabsContent>

          <TabsContent value="older">
            {isLoading ? (
              <NotificationsSkeleton />
            ) : (
              <NotificationsList
                notifications={groups.older}
                onSelect={handleSelect}
                onDismiss={handleDismiss}
              />
            )}
          </TabsContent>
        </Tabs>
      </PageContent>
    </PageLayout>
  );
}
