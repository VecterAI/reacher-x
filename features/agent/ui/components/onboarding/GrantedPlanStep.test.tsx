// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { GrantedPlanStep } from "./GrantedPlanStep";

const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery,
  useMutation: () => vi.fn(),
}));

function render(plan: { tier: string } | null | undefined) {
  useQuery.mockReturnValue(plan);
  return renderToStaticMarkup(
    createElement(GrantedPlanStep, { threadId: "setup-thread" })
  );
}

test("waits with a disabled button while the plan query is loading", () => {
  const html = render(undefined);
  expect(html).toContain("Loading plan...");
  expect(html).toContain('disabled=""');
  expect(html).not.toContain("Your plan access is ready");
});

test.each([null, { tier: "free" }])(
  "resolved absent or revoked access does not promise a plan or remain loading: %j",
  (plan) => {
    const html = render(plan);
    expect(html).toContain("Plan access unavailable");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("Continue with");
    expect(html).not.toContain("Loading plan...");
    expect(html).not.toContain("Your plan access is ready");
  }
);

test.each(["Hobby", "Base", "Pro"])(
  "%s access enables the final setup action",
  (tier) => {
    const html = render({ tier: tier.toLowerCase() });
    expect(html).toContain(`Continue with ${tier}`);
    expect(html).not.toContain('disabled=""');
    expect(html).toContain("Your plan access is ready");
  }
);
