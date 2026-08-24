import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildOutreachNotificationToastPlan,
  MAX_INDIVIDUAL_OUTREACH_TOASTS,
} from "../shared/lib/notifications/outreachNotificationToastPolicy";

function createNotification(id: string, eventVersion = 1) {
  return {
    _creationTime: 1,
    _id: id,
    eventVersion,
    eventUpdatedAt: 1,
  };
}

test("small notification groups remain individually actionable", () => {
  const notifications = [
    createNotification("first"),
    createNotification("second"),
    createNotification("third"),
  ];

  const plan = buildOutreachNotificationToastPlan(notifications, new Set());

  assert.equal(MAX_INDIVIDUAL_OUTREACH_TOASTS, 3);
  assert.deepEqual(plan.notifications, notifications);
  assert.equal(plan.coalescedCount, 0);
});

test("a 100-notification backlog becomes one summary toast", () => {
  const notifications = Array.from({ length: 100 }, (_, index) =>
    createNotification(`notification-${index}`)
  );

  const plan = buildOutreachNotificationToastPlan(notifications, new Set());

  assert.deepEqual(plan.notifications, []);
  assert.equal(plan.coalescedCount, 100);
});

test("shown event keys are not resurfaced as duplicate toasts", () => {
  const notifications = [
    createNotification("shown"),
    createNotification("new"),
  ];

  const plan = buildOutreachNotificationToastPlan(
    notifications,
    new Set(["shown:1:1"])
  );

  assert.deepEqual(plan.notifications, [notifications[1]]);
  assert.equal(plan.coalescedCount, 0);
});

test("the toast hook serializes individual toasts and coalesces bursts", () => {
  const source = readFileSync(
    "shared/hooks/useOutreachNotificationToast.ts",
    "utf8"
  );

  assert.match(source, /onAutoClose: advanceQueue/);
  assert.match(source, /onDismiss: advanceQueue/);
  assert.match(source, /buildOutreachNotificationToastPlan/);
  assert.match(source, /Open Notifications to review/);
});

test("dedicated prospect panels have no left border or mobile side borders", () => {
  const source = readFileSync(
    "features/prospects/ui/pages/UseCaseProspectPage.tsx",
    "utf8"
  );
  const pageLayout = readFileSync(
    "features/webapp/ui/components/page/PageLayout.tsx",
    "utf8"
  );

  assert.match(source, /md:border-border md:border-r/);
  assert.match(
    source,
    /w-full max-w-none border-x-0 md:border-l-0 \[&_\[data-page-layout\]\]:max-w-none \[&_\[data-page-layout\]\]:border-x-0/
  );
  assert.equal(
    source.match(/\[&_\[data-page-layout\]\]:border-x-0/g)?.length,
    2
  );
  assert.doesNotMatch(source, /DESKTOP_PANEL_BORDER_CLASS_NAME/);
  assert.match(pageLayout, /data-page-layout/);
});

test("waiting for connection uses a static calendar icon", () => {
  const taskSource = readFileSync(
    "features/prospects/ui/components/outreach-plan/TaskItem.tsx",
    "utf8"
  );
  const spinnerSource = readFileSync(
    "shared/ui/components/AsciiSpinnerText.tsx",
    "utf8"
  );

  assert.match(taskSource, /CalendarClockIcon/);
  assert.doesNotMatch(taskSource, /waiting_connection: "pulse"/);
  assert.doesNotMatch(spinnerSource, /pulse/);
});
