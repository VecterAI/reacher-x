// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Doc } from "@/convex/_generated/dataModel";
import { ProspectCard } from "./ProspectCard";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  openProfile: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/shared/hooks", () => ({
  useActiveUseCaseLabels: () => ({
    entityPlural: "Prospects",
    entitySingular: "Prospect",
  }),
}));
vi.mock(
  "@/features/webapp/ui/components/tweet/useTwitterProfileNavigation",
  () => ({
    useTwitterProfileNavigation: () => ({ openProfile: mocks.openProfile }),
  })
);
vi.mock("./ProspectCardMenu", () => ({ ProspectCardMenu: () => null }));
vi.mock("@/shared/ui/components/AnimatedPercent", () => ({
  default: ({ value }: { value: number }) => <span>{value}%</span>,
}));

type StoredProspect = Doc<"prospects">;

function createProspect(
  overrides: Partial<StoredProspect> = {}
): StoredProspect {
  return {
    _id: "prospects:legacy-1" as StoredProspect["_id"],
    _creationTime: 1721472000000,
    displayName: "Jane Doe",
    platform: "twitter",
    prospectType: "individual",
    data: {},
    socialProfiles: {},
    status: "new",
    title: "Founder",
    briefIntro: "Legacy bio from enrichment",
    planGenerationStatus: "idle",
    qualificationStatus: "qualified",
    qualificationScore: 88,
    ...overrides,
  } as StoredProspect;
}

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function renderProspect(
  prospect: Parameters<typeof ProspectCard>[0]["prospect"]
) {
  root = createRoot(host);
  act(() => {
    root.render(<ProspectCard prospect={prospect} />);
  });
  return host;
}

test("prospects with qualification reasoning show reasoning in the card body", () => {
  const container = renderProspect(
    createProspect({
      qualificationReasoning: "Matches the ICP: hiring platform founder",
    })
  );

  expect(container.textContent).toContain(
    "Matches the ICP: hiring platform founder"
  );
  expect(container.textContent).not.toContain("Legacy bio from enrichment");
});

test("legacy prospects without reasoning fall back to their bio", () => {
  const container = renderProspect(createProspect());

  expect(container.textContent).toContain("Legacy bio from enrichment");
});

test("blank reasoning falls back to the bio", () => {
  const container = renderProspect(
    createProspect({ qualificationReasoning: "   " })
  );

  expect(container.textContent).toContain("Legacy bio from enrichment");
});

test("prospects with neither reasoning nor bio render no body text", () => {
  const container = renderProspect(
    createProspect({ briefIntro: undefined, title: undefined })
  );

  expect(container.querySelector("article p")).toBeNull();
});

test("synthetic preview cards keep rendering their brief intro", () => {
  const container = renderProspect({
    synthetic: true,
    displayName: "Sample Person",
    platform: "twitter",
    title: "Sample title",
    briefIntro: "Synthetic bio text",
    prospectType: "individual",
  });

  expect(container.textContent).toContain("Synthetic bio text");
});
