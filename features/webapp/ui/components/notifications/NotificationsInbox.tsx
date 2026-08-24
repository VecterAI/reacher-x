"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Doc } from "@/convex/_generated/dataModel";
import { normalizeNotificationCopy } from "@/features/webapp/lib/notificationCopy";
import { getOutreachNotificationEventTimestamp } from "@/shared/lib/notifications/outreachNotificationEvents";
import { cn, formatRelativeTime, parseText } from "@/shared/lib/utils";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { Button } from "@/shared/ui/components/Button";
import { InfiniteScrollTrigger } from "@/shared/ui/components/InfiniteScrollTrigger";
import { ProspectPlatformAvatar } from "@/shared/ui/components/ProspectPlatformAvatar";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/components/Tabs";
import {
  CheckCircleIcon,
  CloseIcon,
  FramePersonIcon,
  NotificationsIcon,
  PsychologyAltIcon,
  QuickPhrasesIcon,
  RepeatIcon,
  WarningIcon,
} from "@/shared/ui/components/icons";

export type NotificationItem = Omit<
  Pick<
    Doc<"outreachNotifications">,
    | "_creationTime"
    | "actionLabel"
    | "actionRequestId"
    | "eventUpdatedAt"
    | "message"
    | "prospectAvatarUrl"
    | "prospectDisplayName"
    | "prospectId"
    | "prospectPlatform"
    | "prospectType"
    | "replyCount"
    | "status"
    | "targetHref"
    | "taskId"
    | "threadId"
    | "title"
    | "type"
  >,
  "actionRequestId" | "prospectId" | "taskId"
> & {
  _id: string;
  actionRequestId?: string;
  prospectId?: string;
  taskId?: string;
};

type NotificationGroup = {
  today: NotificationItem[];
  yesterday: NotificationItem[];
  older: NotificationItem[];
};

const EMPTY_NOTIFICATIONS: NotificationItem[] = [];

type NotificationListItem =
  | {
      kind: "single";
      notification: NotificationItem;
    }
  | {
      kind: "group";
      notification: NotificationItem;
      notifications: NotificationItem[];
    };

function groupNotificationsByDay(
  notifications: NotificationItem[]
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
    const eventDate = new Date(
      getOutreachNotificationEventTimestamp(notification)
    );
    if (eventDate >= today) {
      groups.today.push(notification);
    } else if (eventDate >= yesterday) {
      groups.yesterday.push(notification);
    } else {
      groups.older.push(notification);
    }
  }

  return groups;
}

function getNotificationIcon(type: NotificationItem["type"]) {
  switch (type) {
    case "prospects_found":
      return <FramePersonIcon className="fill-current" />;
    case "outreach_sent":
      return <NotificationsIcon className="fill-current" />;
    case "prospect_replied":
      return <QuickPhrasesIcon className="fill-current" />;
    case "ask_human":
      return <PsychologyAltIcon className="size-4" />;
    case "twitter_action_request":
    case "social_action_request":
      return <RepeatIcon className="size-4 fill-current" />;
    case "social_action_completed":
      return <CheckCircleIcon className="size-4 fill-current" />;
    case "setup_preview_ready":
      return <CheckCircleIcon className="size-4 fill-current" />;
    case "plan_batch_ready":
    case "plan_batch_started":
      return <NotificationsIcon className="fill-current" />;
    case "social_action_failed":
    case "plan_batch_partial":
    case "plan_batch_failed":
    case "error":
      return <WarningIcon className="size-4 fill-current" />;
    case "plan_completed":
    case "plan_batch_completed":
      return <CheckCircleIcon className="size-4 fill-current" />;
    default:
      return <NotificationsIcon className="fill-current" />;
  }
}

function shouldGroupByProspect(notification: NotificationItem) {
  return (
    Boolean(notification.prospectId) &&
    (notification.type === "prospect_replied" ||
      notification.type === "outreach_sent")
  );
}

function createNotificationListItems(
  notifications: NotificationItem[]
): NotificationListItem[] {
  const items: NotificationListItem[] = [];

  for (const notification of notifications) {
    const previous = items.at(-1);
    if (
      previous &&
      shouldGroupByProspect(notification) &&
      shouldGroupByProspect(previous.notification) &&
      previous.notification.prospectId === notification.prospectId
    ) {
      items[items.length - 1] = {
        kind: "group",
        notification: previous.notification,
        notifications:
          previous.kind === "group"
            ? [...previous.notifications, notification]
            : [previous.notification, notification],
      };
      continue;
    }

    items.push({ kind: "single", notification });
  }

  return items;
}

function getNotificationTitleParts(notification: NotificationItem) {
  const displayName = notification.prospectDisplayName?.trim();
  if (!displayName || !notification.prospectId) {
    return null;
  }

  if (
    (notification.type === "social_action_request" ||
      notification.type === "twitter_action_request") &&
    notification.title === `Approve DM to ${displayName}`
  ) {
    return {
      prefix: "Approve DM to ",
      name: displayName,
      suffix: "",
    };
  }

  if (
    notification.title.startsWith(displayName) &&
    notification.title.length > displayName.length
  ) {
    return {
      prefix: "",
      name: displayName,
      suffix: notification.title.slice(displayName.length),
    };
  }

  const displayNameIndex = notification.title.indexOf(displayName);
  if (displayNameIndex >= 0) {
    return {
      prefix: notification.title.slice(0, displayNameIndex),
      name: displayName,
      suffix: notification.title.slice(displayNameIndex + displayName.length),
    };
  }

  const platformLabel =
    notification.prospectPlatform === "linkedin"
      ? "LinkedIn"
      : notification.prospectPlatform === "twitter"
        ? "X/Twitter"
        : "their profile";

  switch (notification.type) {
    case "outreach_sent":
      return {
        prefix: `Message sent to `,
        name: displayName,
        suffix:
          notification.prospectPlatform != null ? ` on ${platformLabel}` : "",
      };
    case "social_action_completed":
      return {
        prefix: `Reply sent to `,
        name: displayName,
        suffix:
          notification.prospectPlatform != null ? ` on ${platformLabel}` : "",
      };
    case "social_action_failed":
      return {
        prefix:
          notification.prospectPlatform != null
            ? `${platformLabel} action for `
            : `Action for `,
        name: displayName,
        suffix: ` failed`,
      };
    case "plan_completed":
      return {
        prefix: `Plan completed for `,
        name: displayName,
        suffix: "",
      };
    default:
      return null;
  }
}

function renderProspectNameLink(
  name: string,
  prospectId: string,
  detailHref: (prospectId: string) => string,
  router: ReturnType<typeof useRouter>
) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        router.push(detailHref(prospectId));
      }}
      className="font-bold hover:underline"
    >
      {name}
    </button>
  );
}

interface NotificationCardProps {
  notification: NotificationItem;
  groupedNotifications?: NotificationItem[];
  onSelect: () => void;
  onDismiss: () => void;
}

function NotificationCard({
  notification,
  groupedNotifications = EMPTY_NOTIFICATIONS,
  onSelect,
  onDismiss,
}: NotificationCardProps) {
  const router = useRouter();
  const { entitySingular, routes } = useActiveUseCaseLabels();
  const threadNotifications = React.useMemo(
    () =>
      [...groupedNotifications].sort(
        (a, b) =>
          getOutreachNotificationEventTimestamp(a) -
          getOutreachNotificationEventTimestamp(b)
      ),
    [groupedNotifications]
  );
  const hasThread = threadNotifications.length > 1;
  const notificationEventTimestamp =
    getOutreachNotificationEventTimestamp(notification);
  const timeAgo = formatRelativeTime(
    new Date(notificationEventTimestamp).toISOString()
  );

  const isPending = threadNotifications.some(
    (item) => item.status === "pending"
  );
  const showAvatar = Boolean(
    notification.prospectAvatarUrl || notification.prospectDisplayName
  );
  const avatarShape =
    notification.prospectType === "organization"
      ? "rounded-lg"
      : "rounded-full";
  const parsedMessage =
    hasThread || !notification.message
      ? null
      : parseText(
          normalizeNotificationCopy(notification.message, notification.type)
        );
  const titleParts = getNotificationTitleParts(notification);

  return (
    <article
      className={cn("group flex cursor-pointer items-start gap-3 px-4 py-4")}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === "Enter" && onSelect()}
    >
      <div className="shrink-0 pt-0.5">
        {showAvatar ? (
          <ProspectPlatformAvatar
            platform={notification.prospectPlatform}
            badgeSize="sm"
          >
            <Avatar className={cn("ring-border size-8 ring-1", avatarShape)}>
              <AvatarImage
                src={notification.prospectAvatarUrl}
                alt={notification.prospectDisplayName || entitySingular}
              />
              <AvatarFallback className={avatarShape}>
                {notification.prospectDisplayName?.charAt(0).toUpperCase() ||
                  "?"}
              </AvatarFallback>
            </Avatar>
          </ProspectPlatformAvatar>
        ) : (
          <div className="border-border text-foreground flex size-8 items-center justify-center rounded-md border">
            {getNotificationIcon(notification.type)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        {hasThread ? (
          <>
            <div className="space-y-0.5">
              <p className="text-foreground text-sm font-medium">
                {titleParts && notification.prospectId ? (
                  <>
                    {titleParts.prefix}
                    {renderProspectNameLink(
                      titleParts.name,
                      notification.prospectId,
                      routes.detailHref,
                      router
                    )}
                    {titleParts.suffix}
                  </>
                ) : (
                  (notification.prospectDisplayName ?? notification.title)
                )}
              </p>
              <p className="text-muted-foreground text-sm">
                Recent activity in this thread
              </p>
            </div>
            <div className="space-y-3 pt-1">
              {threadNotifications.map((item, index) => {
                const itemEventTimestamp =
                  getOutreachNotificationEventTimestamp(item);
                const itemTimeAgo = formatRelativeTime(
                  new Date(itemEventTimestamp).toISOString()
                );
                const itemMessage = item.message
                  ? parseText(
                      normalizeNotificationCopy(item.message, item.type)
                    )
                  : null;
                const isLastItem = index === threadNotifications.length - 1;

                return (
                  <div key={item._id} className="flex gap-3">
                    <div className="relative flex w-4 shrink-0 justify-center">
                      {!isLastItem ? (
                        <span
                          className="bg-border absolute top-4 bottom-[-12px] left-1/2 w-px -translate-x-1/2"
                          aria-hidden
                        />
                      ) : null}
                      <span
                        className={cn(
                          "bg-background border-border relative z-10 mt-1 size-2.5 rounded-full border",
                          index === 0
                            ? "border-muted-foreground/50"
                            : "border-foreground"
                        )}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm leading-5",
                          isLastItem
                            ? "text-foreground font-medium"
                            : "text-foreground/85"
                        )}
                      >
                        {item.title}
                      </p>
                      {itemMessage ? (
                        <p className="[&_a]:text-muted-foreground text-muted-foreground mt-0.5 line-clamp-2 text-sm whitespace-pre-line [&_a]:hover:underline">
                          {itemMessage}
                        </p>
                      ) : null}
                      <time
                        dateTime={new Date(itemEventTimestamp).toISOString()}
                        className="text-muted-foreground mt-0.5 block text-sm"
                      >
                        {itemTimeAgo}
                      </time>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect();
                }}
              >
                View activity
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-foreground text-sm font-medium">
              {titleParts ? (
                <>
                  {titleParts.prefix}
                  {notification.prospectId
                    ? renderProspectNameLink(
                        titleParts.name,
                        notification.prospectId,
                        routes.detailHref,
                        router
                      )
                    : titleParts.name}
                  {titleParts.suffix}
                </>
              ) : (
                <span>{notification.title}</span>
              )}
            </p>
            {parsedMessage ? (
              <p className="[&_a]:text-muted-foreground text-muted-foreground mt-0.5 line-clamp-2 text-sm whitespace-pre-line [&_a]:hover:underline">
                {parsedMessage}
              </p>
            ) : null}
            <time
              dateTime={new Date(notificationEventTimestamp).toISOString()}
              className="text-muted-foreground block text-sm"
            >
              {timeAgo}
            </time>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-start gap-2 pt-0.5">
        {notification.actionLabel ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
          >
            {notification.actionLabel}
          </Button>
        ) : null}
        {isPending ? (
          <span
            className="bg-foreground mt-2 size-2 rounded-full"
            aria-label="Pending notification"
          />
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="xsIcon"
          aria-label="Dismiss notification"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
        >
          <CloseIcon className="size-3.5 fill-current" />
        </Button>
      </div>
    </article>
  );
}

interface NotificationsListProps {
  notifications: NotificationItem[];
  onSelect: (
    notification: NotificationItem,
    rowNotifications: NotificationItem[]
  ) => void;
  onDismiss: (notificationId: string) => void;
}

function NotificationsList({
  notifications,
  onSelect,
  onDismiss,
}: NotificationsListProps) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div>
      {createNotificationListItems(notifications).map((item) => (
        <NotificationCard
          key={item.notification._id}
          notification={item.notification}
          groupedNotifications={
            item.kind === "group" ? item.notifications : [item.notification]
          }
          onSelect={() =>
            onSelect(
              item.notification,
              item.kind === "group" ? item.notifications : [item.notification]
            )
          }
          onDismiss={() => onDismiss(item.notification._id)}
        />
      ))}
    </div>
  );
}

function NotificationSingleSkeleton({
  avatarShape = "rounded-full",
  iconOnly = false,
  pending = false,
}: {
  avatarShape?: "rounded-full" | "rounded-lg";
  iconOnly?: boolean;
  pending?: boolean;
}) {
  return (
    <article className="card-fade-bottom-mid flex items-start gap-3 px-4 py-4">
      <div className="shrink-0 pt-0.5">
        {iconOnly ? (
          <Skeleton className="size-8 rounded-md" />
        ) : (
          <Skeleton className={cn("size-8", avatarShape)} />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-[92%]" />
        <Skeleton className="h-3 w-16" />
      </div>

      <div className="flex shrink-0 items-start gap-2 pt-0.5">
        {pending ? <Skeleton className="mt-2 size-2 rounded-full" /> : null}
        <Skeleton className="size-7 rounded-md" />
      </div>
    </article>
  );
}

function NotificationThreadSkeleton() {
  return (
    <article className="card-fade-bottom-mid flex items-start gap-3 px-4 py-4">
      <div className="shrink-0 pt-0.5">
        <Skeleton className="size-8 rounded-full" />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-36" />
        </div>

        <div className="space-y-3 pt-1">
          {[1, 2, 3].map((item, index) => {
            const isLastItem = index === 2;
            return (
              <div key={item} className="flex gap-3">
                <div className="relative flex w-4 shrink-0 justify-center">
                  {!isLastItem ? (
                    <span
                      className="bg-border absolute top-4 bottom-[-12px] left-1/2 w-px -translate-x-1/2"
                      aria-hidden
                    />
                  ) : null}
                  <Skeleton
                    className={cn(
                      "relative z-10 mt-1 size-2.5 rounded-full",
                      index === 2 ? "bg-foreground/30" : "bg-muted"
                    )}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-[68%]" />
                  <Skeleton className="h-3 w-[88%]" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-1">
          <Skeleton className="h-7 w-24 rounded-md" />
        </div>
      </div>

      <div className="flex shrink-0 items-start gap-2 pt-0.5">
        <Skeleton className="mt-2 size-2 rounded-full" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </article>
  );
}

export function NotificationsSkeleton() {
  return (
    <div role="status" aria-label="Loading notifications">
      <NotificationSingleSkeleton pending />
      <NotificationThreadSkeleton />
      <NotificationSingleSkeleton avatarShape="rounded-lg" />
      <NotificationSingleSkeleton iconOnly />
    </div>
  );
}

interface NotificationsInboxProps {
  notifications: NotificationItem[];
  isLoading?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onSelect: (
    notification: NotificationItem,
    rowNotifications: NotificationItem[]
  ) => void;
  onDismiss: (notificationId: string) => void;
}

export function NotificationsInbox({
  notifications,
  isLoading = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onSelect,
  onDismiss,
}: NotificationsInboxProps) {
  const groups = React.useMemo(
    () => groupNotificationsByDay(notifications),
    [notifications]
  );

  const renderNotifications = (day: keyof NotificationGroup) => {
    const dayNotifications = groups[day];

    return (
      <>
        {isLoading ? (
          <NotificationsSkeleton />
        ) : (
          <NotificationsList
            notifications={dayNotifications}
            onSelect={onSelect}
            onDismiss={onDismiss}
          />
        )}
      </>
    );
  };

  return (
    <>
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

        <TabsContent value="today">{renderNotifications("today")}</TabsContent>

        <TabsContent value="yesterday">
          {renderNotifications("yesterday")}
        </TabsContent>

        <TabsContent value="older">{renderNotifications("older")}</TabsContent>
      </Tabs>
      {!isLoading && onLoadMore ? (
        <InfiniteScrollTrigger
          hasMore={hasMore}
          isLoading={isLoadingMore}
          onLoadMore={onLoadMore}
          resultCount={notifications.length}
          className="mx-4"
          loadingLabel="Loading more notifications"
          loadMoreLabel="Load more notifications"
          retryLabel="Retry loading notifications"
        />
      ) : null}
    </>
  );
}
