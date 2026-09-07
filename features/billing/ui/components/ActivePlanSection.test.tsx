// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  ActivePlanSection,
  type ActivePlanSectionProps,
} from "./ActivePlanSection";

function render(
  plan: ActivePlanSectionProps["plan"],
  subscription: ActivePlanSectionProps["subscription"] = null
) {
  return renderToStaticMarkup(
    createElement(ActivePlanSection, {
      plan,
      subscription,
      isPaid: plan?.tier !== "free",
      onUpgrade() {},
      onUpgradeToPro() {},
      onManageBilling() {},
    })
  );
}

describe("complimentary billing presentation", () => {
  test("shows a gift expiry without promising renewal or offering an empty billing portal", () => {
    const html = render({
      tier: "hobby",
      subscriptionTier: "free",
      complimentaryGrant: {
        tier: "hobby",
        expiresAt: Date.UTC(2026, 9, 7, 12),
      },
    });
    expect(html).toContain("Complimentary Hobby access");
    expect(html).toContain("<time");
    expect(html).toContain("No subscription charge");
    expect(html).not.toContain("Renews");
    expect(html).not.toContain("Manage billing");
  });
  test("explains the paid subscription separately and allows purchase during a Pro gift", () => {
    const html = render(
      {
        tier: "pro",
        subscriptionTier: "hobby",
        complimentaryGrant: {
          tier: "pro",
          expiresAt: Date.UTC(2026, 9, 7, 12),
        },
      },
      {
        recurringInterval: "month",
        currentPeriodEnd: "2026-09-20T12:00:00.000Z",
      }
    );
    expect(html).toContain("Your Hobby subscription continues separately");
    expect(html).toContain("Choose a paid plan");
    expect(html).toContain("Manage billing");
    expect(html).toContain("Sep 20, 2026");
  });
  test("ordinary paid plans keep renewal and cancellation messaging", () => {
    const html = render(
      { tier: "base" },
      {
        recurringInterval: "year",
        currentPeriodEnd: "2027-01-15T12:00:00.000Z",
        cancelAtPeriodEnd: true,
      }
    );
    expect(html).toContain("Access until");
    expect(html).toContain("Jan 15, 2027");
    expect(html).not.toContain("Complimentary");
  });
});
