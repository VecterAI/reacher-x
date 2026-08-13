import {
  getOutreachNotificationEventKey,
  type OutreachNotificationEvent,
} from "./outreachNotificationEvents";

/** Keep small groups useful while preventing a loaded inbox from flooding Sonner. */
export const MAX_INDIVIDUAL_OUTREACH_TOASTS = 3;

export interface OutreachNotificationToastPlan<
  T extends OutreachNotificationEvent,
> {
  notifications: T[];
  coalescedCount: number;
}

export function buildOutreachNotificationToastPlan<
  T extends OutreachNotificationEvent,
>(
  notifications: readonly T[],
  shownNotificationKeys: ReadonlySet<string>
): OutreachNotificationToastPlan<T> {
  const unseenNotifications = notifications.filter(
    (notification) =>
      !shownNotificationKeys.has(getOutreachNotificationEventKey(notification))
  );

  if (unseenNotifications.length <= MAX_INDIVIDUAL_OUTREACH_TOASTS) {
    return {
      notifications: unseenNotifications,
      coalescedCount: 0,
    };
  }

  return {
    notifications: [],
    coalescedCount: unseenNotifications.length,
  };
}
