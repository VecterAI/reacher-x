// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  WorkspacePlanLimitAlert,
  WorkspacePlanLimitNotice,
} from "./WorkspacePlanLimitAlert";
import {
  WorkspaceUsageIndicatorView,
  WorkspaceUsageDetails,
} from "./WorkspaceUsageIndicator";
import type { WorkspacePlanUsage } from "./WorkspacePlanUsageProvider";

const currentUsage = vi.hoisted(() => ({
  value: null as WorkspacePlanUsage | null,
}));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("./WorkspacePlanUsageProvider", () => ({
  useWorkspacePlanUsage: () => ({
    usage: currentUsage.value,
    available: false,
    unavailable: false,
  }),
}));

const usage: WorkspacePlanUsage = {
  workspaceId: "workspace" as Id<"workspaces">,
  workspaceName: "Creators",
  entityPlural: "Creators",
  discoveryVerb: "finding",
  tier: "hobby",
  used: 100,
  limit: 100,
  cycleEnd: Date.UTC(2026, 9, 1),
  noticeKey: "cycle",
  noticeDismissed: false,
  limitReached: true,
};
function renderIndicator(
  value: WorkspacePlanUsage | null,
  unavailable = false
) {
  return renderToStaticMarkup(
    createElement(WorkspaceUsageIndicatorView, { usage: value, unavailable })
  );
}
describe("plan usage UI", () => {
  beforeEach(() => {
    currentUsage.value = null;
  });
  test.each([
    ["below the limit", { ...usage, used: 99, limitReached: false }],
    ["dismissed", { ...usage, noticeDismissed: true }],
    ["unlimited", { ...usage, tier: "pro", limit: -1, limitReached: false }],
    ["unavailable", null],
  ] as const)("hides the notice when %s", (_, value) => {
    currentUsage.value = value;
    expect(renderToStaticMarkup(createElement(WorkspacePlanLimitAlert))).toBe(
      ""
    );
  });
  test.each([
    ["at the limit", usage],
    ["over the limit", { ...usage, used: 105 }],
    [
      "workflow confirmed the limit while usage is pending",
      { ...usage, used: null },
    ],
    [
      "a free workspace requires a plan",
      { ...usage, tier: "free", limit: 0, used: 0, limitReached: false },
    ],
  ] as const)("shows the notice when %s", (_, value) => {
    currentUsage.value = value;
    expect(
      renderToStaticMarkup(createElement(WorkspacePlanLimitAlert))
    ).toContain('aria-label="Plan usage notice"');
  });
  test("retains upgrade and usage links with a named close button", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspacePlanLimitNotice, { usage, onDismiss() {} })
    );
    expect(html).toContain('aria-label="Plan usage notice"');
    expect(html).toContain('aria-label="Dismiss plan usage notice"');
    expect(html).toContain('href="/plans?upgrade=1"');
    expect(html).toContain('href="/usage"');
    expect(html).toContain(
      "This workspace has reached its plan limit for creators this cycle."
    );
    expect(html).toContain('stroke-dasharray="1 1"');
    expect(html.match(/<p\b/g)).toHaveLength(1);
    expect(html).not.toContain("<text");
    expect(html).not.toContain('role="img"');
    expect(html).toContain("100%");
  });
  test("dismissal errors stay next to the close action and announce themselves", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspacePlanLimitNotice, {
        usage,
        onDismiss() {},
        error: "Couldn't dismiss this notice. Try again.",
      })
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Try again.");
  });
  test("free plan copy avoids claiming usage exhaustion", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspacePlanLimitNotice, {
        usage: { ...usage, tier: "free", limit: 0 },
        onDismiss() {},
      })
    );
    expect(html).toContain("Choose a plan to start finding creators");
    expect(html).not.toContain("limit reached");
    expect(html).not.toContain("usage resets");
  });
  test("finite ring retains a full accessible label and clamps excess usage", () => {
    const html = renderIndicator({ ...usage, used: 105 });
    expect(html).toContain("Usage. 105 of 100 creators used");
    expect(html).toContain('stroke-dasharray="1 1"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain("text-chart-1");
    expect(html).not.toContain("text-destructive");
    expect(html).toContain("text-chart-1 size-4 shrink-0");
    expect(html).not.toContain("[&_svg]:size-5");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('href="/usage"');
  });
  test("an empty ring does not leave a rounded progress dot", () => {
    const html = renderIndicator({ ...usage, used: 0, limitReached: false });
    expect(html).not.toContain("stroke-dasharray");
    expect(html).toContain('class="text-muted"');
  });
  test("partial usage uses the same chart color and rounded stroke", () => {
    const html = renderIndicator({ ...usage, used: 25, limitReached: false });
    expect(html).toContain('stroke-dasharray="0.25 1"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain('viewBox="0 0 20 20"');
  });
  test("unlimited usage has an infinity marker, not a full or negative ring", () => {
    const html = renderIndicator({
      ...usage,
      tier: "pro",
      limit: -1,
      limitReached: false,
    });
    expect(html).toContain("Unlimited plan");
    expect(html).toContain("∞");
    expect(html).not.toContain("stroke-dasharray");
  });
  test("unknown and failed queries never display a fabricated usage count", () => {
    expect(renderIndicator(null)).toContain("Usage is being updated");
    expect(renderIndicator(null, true)).toContain(
      "Usage unavailable. Open usage to try again"
    );
    expect(renderIndicator({ ...usage, used: null })).not.toContain("0 of 100");
  });
  test("popover details retain plan actions and an accessible usage meter", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceUsageDetails, {
        usage: { ...usage, used: 105 },
        unavailable: false,
        onNavigate() {},
      })
    );
    expect(html).toContain('href="/usage"');
    expect(html).toContain('href="/plans?upgrade=1"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('aria-valuetext="105 of 100 used"');
    expect(html).toContain("Limit reached");
  });
  test("unlimited popover avoids an irrelevant upgrade or finite meter", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceUsageDetails, {
        usage: { ...usage, tier: "pro", limit: -1, limitReached: false },
        unavailable: false,
        onNavigate() {},
      })
    );
    expect(html).toContain("Unlimited plan");
    expect(html).toContain('href="/usage"');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain("Upgrade plan");
  });
  test("failed popover queries offer a path to usage without fabricated data", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceUsageDetails, {
        usage: null,
        unavailable: true,
        onNavigate() {},
      })
    );
    expect(html).toContain("Open usage to try again");
    expect(html).toContain('href="/usage"');
    expect(html).not.toContain('role="progressbar"');
  });
});
