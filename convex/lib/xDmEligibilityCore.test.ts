import { describe, expect, it } from "vitest";
import {
  buildXDmEligibility,
  getBlockedXDmPlanMessage,
  hasBlockedImmediateXDmTask,
} from "./xDmEligibilityCore";

const base = {
  isConnected: true,
  recipientDisplayName: "Avery Stone",
  recipientUsername: "avery",
  recipientVerified: true,
  senderUsername: "testing_demo",
  senderVerified: false,
};

describe("X/Twitter DM eligibility", () => {
  it("allows a recipient that X/Twitter says can receive the DM", () => {
    expect(
      buildXDmEligibility({ ...base, receivesYourDm: true })
    ).toMatchObject({
      enabled: true,
      reasonCode: "eligible",
      recipientLabel: "Avery Stone",
      senderUsername: "@testing_demo",
      nextSteps: [],
    });
  });

  it("names both people when the recipient does not accept the DM", () => {
    const eligibility = buildXDmEligibility({
      ...base,
      receivesYourDm: false,
    });

    expect(eligibility).toMatchObject({
      enabled: false,
      reasonCode: "not_allowed",
      reasonTitle: "Can't message Avery Stone",
      nextSteps: expect.arrayContaining([
        "public_engagement",
        "wait_for_follow_back",
        "switch_account",
      ]),
    });
    expect(eligibility.reasonLabel).toContain("@testing_demo");
    expect(eligibility.reasonLabel).toContain("Avery Stone");
    expect(eligibility.reasonLabel).not.toContain("This user");
  });

  it("uses verification copy only for an explicit subscription restriction", () => {
    const eligibility = buildXDmEligibility({
      ...base,
      restriction: "subscription_required",
    });

    expect(eligibility).toMatchObject({
      enabled: false,
      reasonCode: "subscription_required",
      reasonTitle: "Verification required",
      nextSteps: ["verify_account", "switch_account", "wait_for_follow_back"],
    });
    expect(eligibility.reasonLabel).toContain("verified accounts");
  });

  it("keeps an explicit provider denial ahead of older positive eligibility", () => {
    expect(
      buildXDmEligibility({
        ...base,
        receivesYourDm: true,
        restriction: "not_allowed",
      })
    ).toMatchObject({
      enabled: false,
      reasonCode: "not_allowed",
      receivesYourDm: false,
    });
  });

  it("keeps an omitted receives_your_dm value unknown instead of false", () => {
    expect(buildXDmEligibility(base)).toMatchObject({
      enabled: false,
      reasonCode: "unknown",
      reasonTitle: "Can't check X/Twitter DM access",
      nextSteps: ["recheck_eligibility"],
    });
  });

  it.each([
    [false, undefined, "missing_connection"],
    [true, ["dm.write"], "missing_scopes"],
  ] as const)(
    "reports connection and scope failures before recipient settings",
    (isConnected, missingScopes, reasonCode) => {
      expect(
        buildXDmEligibility({
          ...base,
          isConnected,
          missingScopes: missingScopes ? [...missingScopes] : undefined,
          receivesYourDm: true,
        }).reasonCode
      ).toBe(reasonCode);
    }
  );

  it("blocks only immediate DM plan steps and explains that following alone is insufficient", () => {
    const eligibility = buildXDmEligibility({
      ...base,
      receivesYourDm: false,
    });

    expect(
      hasBlockedImmediateXDmTask(
        [{ type: "dm", timing: { type: "immediate" } }],
        eligibility
      )
    ).toBe(true);
    expect(
      hasBlockedImmediateXDmTask(
        [
          { type: "comment", timing: { type: "immediate" } },
          { type: "wait", timing: { type: "event" } },
          { type: "dm", timing: { type: "event" } },
        ],
        eligibility
      )
    ).toBe(false);
    expect(getBlockedXDmPlanMessage(eligibility)).toContain(
      "Following Avery Stone does not unlock DMs unless they follow back"
    );
  });

  it.each([
    [
      buildXDmEligibility({ ...base, isConnected: false }),
      "Connect an X/Twitter account",
    ],
    [
      buildXDmEligibility({ ...base, missingScopes: ["dm.write"] }),
      "Reconnect X/Twitter",
    ],
    [buildXDmEligibility(base), "Don't plan an immediate DM"],
  ])("gives the agent a reason-specific recovery", (eligibility, expected) => {
    expect(getBlockedXDmPlanMessage(eligibility)).toContain(expected);
    expect(getBlockedXDmPlanMessage(eligibility)).not.toContain(
      "switch to an eligible X/Twitter account"
    );
  });
});
