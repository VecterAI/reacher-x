/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import polarTest from "@convex-dev/polar/test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";
import { parsePlanOffers } from "../shared/lib/billing/planOfferHelpers";
import { getPolarPlanTier, hasPolarPlanAccess } from "./lib/polarPlanHelpers";

import { polar } from "./polar";
const calls = {
  checkout: vi.spyOn(polar, "createCheckoutSession"),
  change: vi.spyOn(polar, "changeSubscription"),
};
const modules = import.meta.glob("./**/*.ts");
const all = parsePlanOffers(
  "hobby:monthly,hobby:yearly,base:monthly,base:yearly,pro:monthly,pro:yearly"
);
const productId = (offer: (typeof all)[number]) =>
  `product-${offer.tier}-${offer.billingPeriod}`;
const checkoutArgs = {
  origin: "http://localhost:3016",
  successUrl: "http://localhost:3016/success",
};

beforeEach(() => {
  for (const offer of all)
    vi.stubEnv(
      `POLAR_PRODUCT_${offer.tier.toUpperCase()}_${offer.billingPeriod.toUpperCase()}`,
      productId(offer)
    );
  vi.stubEnv(
    "AVAILABLE_PLAN_OFFERS",
    "base:monthly,base:yearly,pro:monthly,pro:yearly"
  );
  calls.checkout.mockReset().mockResolvedValue({
    url: "https://sandbox.polar.sh/checkout/test",
  } as Awaited<ReturnType<typeof polar.createCheckoutSession>>);
  calls.change.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

async function fixture() {
  const t = convexTest(schema, modules);
  polarTest.register(t);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      workosUserId: "offer-test",
      email: "offers@example.com",
    })
  );
  await t.mutation(components.polar.lib.insertCustomer, {
    userId,
    id: "customer-offer-test",
  });
  return t.withIdentity({ subject: "offer-test" });
}

test("public availability reads current env on each invocation without redeploy", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.billing.getAvailableOffers)).toHaveLength(4);
  vi.stubEnv("AVAILABLE_PLAN_OFFERS", "pro:yearly");
  expect(await t.query(api.billing.getAvailableOffers)).toEqual([
    { tier: "pro", billingPeriod: "yearly" },
  ]);
  vi.stubEnv("AVAILABLE_PLAN_OFFERS", "");
  expect(await t.query(api.billing.getAvailableOffers)).toEqual([]);
});

test.each(all)(
  "enabled $tier $billingPeriod reaches Polar with only the selected product",
  async (offer) => {
    const t = await fixture();
    vi.stubEnv("AVAILABLE_PLAN_OFFERS", `${offer.tier}:${offer.billingPeriod}`);
    const result = await t.action(api.billing.startCheckoutFlow, {
      ...offer,
      origin: checkoutArgs.origin,
      source: "onboarding_plan",
      returnTo: "/agent/setup?threadId=thread-test",
      threadId: "thread-test",
    });
    expect(result.url).toContain("sandbox.polar.sh");
    expect(calls.checkout).toHaveBeenCalledTimes(1);
    const request = calls.checkout.mock.calls[0][1];
    expect(request.productIds).toEqual([productId(offer)]);
    expect(request.email).toBe("offers@example.com");
    const success = new URL(request.successUrl);
    expect(success.searchParams.get("tier")).toBe(offer.tier);
    expect(success.searchParams.get("billingPeriod")).toBe(offer.billingPeriod);
    expect(success.searchParams.get("threadId")).toBe("thread-test");
  }
);

test.each(all)(
  "disabled $tier $billingPeriod is rejected by every purchase entry point",
  async (offer) => {
    const t = await fixture();
    vi.stubEnv(
      "AVAILABLE_PLAN_OFFERS",
      all
        .filter((candidate) => productId(candidate) !== productId(offer))
        .map((candidate) => `${candidate.tier}:${candidate.billingPeriod}`)
        .join(",")
    );
    await expect(
      t.action(api.billing.startCheckoutFlow, {
        ...offer,
        origin: checkoutArgs.origin,
        source: "plans_page_upgrade",
      })
    ).rejects.toThrow("no longer available");
    await expect(
      t.action(api.polar.generateCheckoutLink, {
        ...checkoutArgs,
        productIds: [productId(offer)],
      })
    ).rejects.toThrow("no longer available");
    await expect(
      t.action(api.polar.changeCurrentSubscription, {
        productId: productId(offer),
      })
    ).rejects.toThrow("no longer available");
    expect(calls.checkout).not.toHaveBeenCalled();
    expect(calls.change).not.toHaveBeenCalled();
  }
);

test("stale pages, malformed config, mixed product lists and unknown IDs cannot bypass availability", async () => {
  const t = await fixture();
  await t.action(api.polar.generateCheckoutLink, {
    ...checkoutArgs,
    productIds: ["product-base-monthly"],
  });
  vi.stubEnv("AVAILABLE_PLAN_OFFERS", "pro:yearly");
  for (const productIds of [
    [],
    [""],
    ["unknown"],
    ["product-base-monthly"],
    ["product-pro-yearly", "product-hobby-yearly"],
  ])
    await expect(
      t.action(api.polar.generateCheckoutLink, { ...checkoutArgs, productIds })
    ).rejects.toThrow("no longer available");
  for (const value of ["", "pro:yearly,typo"]) {
    vi.stubEnv("AVAILABLE_PLAN_OFFERS", value);
    await expect(
      t.action(api.polar.generateCheckoutLink, {
        ...checkoutArgs,
        productIds: ["product-pro-yearly"],
      })
    ).rejects.toThrow("no longer available");
  }
  expect(calls.checkout).toHaveBeenCalledTimes(1);
});

test("availability does not change existing Hobby entitlement mapping or renewal access", () => {
  vi.stubEnv("AVAILABLE_PLAN_OFFERS", "pro:yearly");
  expect(getPolarPlanTier("product-hobby-monthly")).toBe("hobby");
  expect(getPolarPlanTier("product-hobby-yearly")).toBe("hobby");
  for (const status of ["active", "trialing", "past_due"])
    expect(hasPolarPlanAccess(status)).toBe(true);
});

test("enabled purchases still require an authenticated account", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.action(api.polar.generateCheckoutLink, {
      ...checkoutArgs,
      productIds: ["product-base-monthly"],
    })
  ).rejects.toThrow();
  expect(calls.checkout).not.toHaveBeenCalled();
});
