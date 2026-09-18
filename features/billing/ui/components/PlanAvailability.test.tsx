// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  parsePlanOffers,
  type PlanOffer,
} from "@/shared/lib/billing/planOfferHelpers";
import { PlanSelector } from "./PlanSelector";
import { PricingSection } from "@/features/landing/ui/components/sections/PricingSection";

const state = vi.hoisted(() => ({
  data: undefined as PlanOffer[] | undefined,
  isPending: false,
  isError: false,
}));
vi.mock("../../hooks/useAvailablePlanOffers", () => ({
  useAvailablePlanOffers: () => state,
}));
vi.mock("@/shared/hooks", () => ({
  useQueryWithStatus: () => ({ data: null, isPending: false, isError: false }),
}));
vi.mock("@workos-inc/authkit-nextjs/components", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock("@/features/landing/ui/components/LandingAuthLink", () => ({
  LandingAuthLink: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/shared/ui/components/AnimatedNumber", () => ({
  default: ({
    value,
    prefix,
    suffix,
  }: {
    value: number;
    prefix: string;
    suffix: string;
  }) => (
    <span>
      {prefix}
      {value.toFixed(2)}
      {suffix}
    </span>
  ),
}));
let root: Root;
let container: HTMLDivElement;
const upgrade = vi.fn();
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(state, {
    data: parsePlanOffers(undefined),
    isPending: false,
    isError: false,
  });
  upgrade.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
async function render(
  surface: "pricing" | "plans" | "onboarding",
  tier: "free" | "hobby" | "base" | "pro" = "free"
) {
  await act(async () =>
    root.render(
      surface === "pricing" ? (
        <PricingSection />
      ) : (
        <PlanSelector
          mode={surface}
          currentTier={tier}
          onUpgradePaid={upgrade}
        />
      )
    )
  );
}
const text = () => container.textContent ?? "";
const buttons = () =>
  Array.from(container.querySelectorAll("button")).filter((button) =>
    button.textContent?.startsWith("Upgrade for")
  );

test.each(["pricing", "plans", "onboarding"] as const)(
  "%s hides Hobby and gives Base complete features",
  async (surface) => {
    await render(surface);
    expect(text()).not.toContain("Hobby");
    expect(text()).toContain("Base");
    expect(text()).toContain("Pro");
    expect(text().match(/X\/Twitter \+ LinkedIn integrated/g)).toHaveLength(2);
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
  }
);

test.each(["pricing", "plans", "onboarding"] as const)(
  "%s reacts to yearly only, restored Hobby, mixed offers and an empty selection",
  async (surface) => {
    await render(surface);
    state.data = parsePlanOffers("pro:yearly");
    await render(surface);
    expect(text()).not.toMatch(/Base|Hobby|Everything in|\/mo/);
    expect(text()).toContain("Billed yearly");
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(text()).toContain("$999.90/yr");
    if (surface !== "pricing") {
      await act(async () => buttons()[0].click());
      expect(upgrade).toHaveBeenLastCalledWith({
        tier: "pro",
        billing: "yearly",
      });
    }
    state.data = parsePlanOffers("hobby:monthly");
    await render(surface);
    expect(text()).toContain("Hobby");
    expect(text()).not.toContain("Pro");
    expect(text()).toContain("Billed monthly");
    state.data = parsePlanOffers("base:monthly,pro:yearly");
    await render(surface);
    expect(text()).toContain("Base");
    expect(text()).not.toContain("Pro");
    state.data = [];
    await render(surface);
    expect(text()).toContain("Plans are temporarily unavailable");
    expect(text()).not.toMatch(/Hobby|Base|Pro\b/);
    expect(buttons()).toHaveLength(0);
  }
);

test.each(["pricing", "plans", "onboarding"] as const)(
  "%s does not flash offers while loading or after a query error",
  async (surface) => {
    Object.assign(state, { data: undefined, isPending: true });
    await render(surface);
    expect(text()).toContain("Loading plans");
    expect(text()).not.toMatch(/Hobby|Base|Pro\b/);
    Object.assign(state, { isPending: false, isError: true });
    await render(surface);
    expect(text()).toContain("Plans are temporarily unavailable");
    expect(buttons()).toHaveLength(0);
  }
);

test("existing Hobby subscribers can upgrade, while disabled upgrades do not reappear", async () => {
  await render("plans", "hobby");
  expect(buttons()).toHaveLength(2);
  state.data = parsePlanOffers("base:yearly");
  await render("plans", "base");
  expect(text()).toContain("There are no upgrades available");
  expect(buttons()).toHaveLength(0);
});
