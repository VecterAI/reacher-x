import { describe, expect, test } from "vitest";
import {
  parsePlanOffers,
  getPlanOfferSelection,
  getUpgradeOffers,
  isPlanOfferAvailable,
} from "./planOfferHelpers";
import { publicPageMarkdown } from "@/features/landing/lib/agentReadinessCore";

const all = parsePlanOffers(
  "hobby:monthly,hobby:yearly,base:monthly,base:yearly,pro:monthly,pro:yearly"
);
const key = (offer: (typeof all)[number]) =>
  `${offer.tier}:${offer.billingPeriod}`;

test("missing env uses launch offers; empty, malformed and unknown values fail closed", () => {
  expect(parsePlanOffers(undefined).map(key)).toEqual([
    "base:monthly",
    "base:yearly",
    "pro:monthly",
    "pro:yearly",
  ]);
  for (const value of [
    "",
    " ",
    "hobby",
    "pro:annual",
    "base:monthly,typo",
    "pro:monthly,",
    "free:monthly",
    "pro:monthly,,pro:yearly",
  ])
    expect(parsePlanOffers(value)).toEqual([]);
  expect(
    parsePlanOffers(" PRO:YEARLY , pro:yearly , Base:Monthly ").map(key)
  ).toEqual(["base:monthly", "pro:yearly"]);
});

describe("every subset of the six plan offers", () => {
  for (let mask = 0; mask < 64; mask++) {
    test(`combination ${mask}: parse, billing fallback, upgrade rules and Markdown`, () => {
      const expected = all.filter((_, index) => mask & (1 << index));
      const offers = parsePlanOffers(expected.map(key).join(","));
      expect(offers).toEqual(expected);
      for (const preferred of ["monthly", "yearly"] as const) {
        const selection = getPlanOfferSelection(offers, preferred);
        expect(selection.tiers).toEqual(
          offers
            .filter((offer) => offer.billingPeriod === selection.billing)
            .map((offer) => offer.tier)
        );
        if (offers.some((offer) => offer.billingPeriod === preferred))
          expect(selection.billing).toBe(preferred);
        if (offers.length)
          expect(selection.periods).toContain(selection.billing);
      }
      for (const current of ["free", "hobby", "base", "pro"] as const) {
        const rank = ["free", "hobby", "base", "pro"];
        expect(getUpgradeOffers(offers, current)).toEqual(
          offers.filter(
            (offer) => rank.indexOf(offer.tier) > rank.indexOf(current)
          )
        );
      }
      const markdown = publicPageMarkdown("/pricing", [], "", offers)!;
      for (const tier of ["hobby", "base", "pro"] as const) {
        expect(
          markdown.includes(`## ${tier[0].toUpperCase()}${tier.slice(1)}\n`)
        ).toBe(offers.some((offer) => offer.tier === tier));
        for (const period of ["monthly", "yearly"] as const)
          expect(isPlanOfferAvailable(offers, tier, period)).toBe(
            expected.some(
              (offer) => offer.tier === tier && offer.billingPeriod === period
            )
          );
      }
      if (!offers.some((offer) => offer.billingPeriod === "monthly"))
        expect(markdown).not.toContain("Monthly:");
      if (!offers.some((offer) => offer.billingPeriod === "yearly"))
        expect(markdown).not.toContain("Yearly:");
      expect(markdown).not.toContain("Everything in");
    });
  }
});
