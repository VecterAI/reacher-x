/**
 * DemoNotificationsPage
 * Faithful replica of app/(webapp)/notifications/page.tsx running on mock
 * notifications for the active demo use case. Reuses the real
 * NotificationsInbox (prop-driven). Selecting marks rows seen locally;
 * dismissing removes them locally. No navigation targets (mock data).
 * Omitted vs real: WorkspacePlanLimitAlert (Convex-wired), error state.
 */
"use client";

import * as React from "react";
import {
  NotificationsInbox,
  type NotificationItem,
} from "@/features/webapp/ui/components/notifications/NotificationsInbox";
import {
  PageContent,
  PageHeader,
  PageLayout,
  PageScrollArea,
} from "@/features/webapp/ui/components";

const NOTIFICATIONS_BODY_COLUMN_CLASS_NAME =
  "w-full min-w-0 md:w-[min(32rem,100%)] md:max-w-lg";

export function DemoNotificationsPage({
  notifications,
  onBack,
}: {
  notifications: NotificationItem[];
  onBack: () => void;
}) {
  const [items, setItems] = React.useState(notifications);

  const handleSelect = (notification: NotificationItem) => {
    // The real page marks every pending row seen, then navigates to the
    // notification target. Mock data has no target, so only mark seen.
    void notification;
    setItems((current) =>
      current.map((item) =>
        item.status === "pending" ? { ...item, status: "seen" } : item
      )
    );
  };

  const handleDismiss = (notificationId: string) => {
    setItems((current) =>
      current.filter((item) => item._id !== notificationId)
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full">
      <PageLayout className="flex h-full min-h-0 max-w-none flex-col overflow-hidden border-r-0 md:border-r-0">
        <PageHeader title="Notifications" onBack={onBack} />
        <PageScrollArea>
          <PageContent
            className={`${NOTIFICATIONS_BODY_COLUMN_CLASS_NAME} pt-4 pb-6`}
          >
            <NotificationsInbox
              notifications={items}
              isLoading={false}
              onSelect={handleSelect}
              onDismiss={handleDismiss}
            />
          </PageContent>
        </PageScrollArea>
      </PageLayout>
    </div>
  );
}
