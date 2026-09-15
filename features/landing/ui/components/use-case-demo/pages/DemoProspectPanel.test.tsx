// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { DemoProspectPanel } from "./DemoProspectPanel";

vi.mock("@/features/prospects/lib/normalizeProspectProfileData", () => ({
  normalizeProspectProfileData: () => ({}),
}));
vi.mock("../demoEditorialHelpers", () => ({
  getEditorialDemoPlan: () => null,
}));
vi.mock("@/features/prospects/ui/components/ProspectProfilePanel", () => ({
  ProspectProfilePanel: ({
    onOpenTwitterProfile,
  }: {
    onOpenTwitterProfile: () => void;
  }) => (
    <div data-radix-scroll-area-viewport>
      <button onClick={onOpenTwitterProfile}>Open platform profile</button>
    </div>
  ),
}));
vi.mock("./DemoPlatformProfilePanel", () => ({
  DemoPlatformProfilePanel: ({ onBack }: { onBack: () => void }) => (
    <button onClick={onBack}>Back to research</button>
  ),
}));
vi.mock("./DemoConversationPanel", () => ({
  DemoConversationPanel: () => null,
}));
vi.mock("./DemoOutreachPlanSection", () => ({
  DemoOutreachPlanSection: () => null,
}));
vi.mock("@/features/prospects/ui/components/EvidencePostsPanel", () => ({
  EvidencePostsPanel: () => null,
}));

test("returning from a platform profile restores the demo's research scroll position", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <DemoProspectPanel
          prospect={
            { _id: "demo" } as ComponentProps<
              typeof DemoProspectPanel
            >["prospect"]
          }
          actions={{} as ComponentProps<typeof DemoProspectPanel>["actions"]}
          onBack={() => {}}
          presentation={{
            useCase: "customers",
            page: "prospects",
            profileScroll: 180,
          }}
        />
      )
    );
    expect(
      host.querySelector("[data-radix-scroll-area-viewport]")?.scrollTop
    ).toBe(180);
    await act(async () => host.querySelector("button")!.click());
    expect(host.querySelector("[data-radix-scroll-area-viewport]")).toBeNull();
    await act(async () => host.querySelector("button")!.click());
    expect(
      host.querySelector("[data-radix-scroll-area-viewport]")?.scrollTop
    ).toBe(180);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
