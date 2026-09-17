// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { UseCaseProspectPage } from "./UseCaseProspectPage";
const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn(), back: vi.fn() },
  workspace: { _id: "hiring" },
  isWorkspaceLoading: false,
  profile: {
    prospectId: "person-1",
    prospect: { workspaceId: "hiring" },
    loading: false,
    openProspect: vi.fn(),
  },
  routes: {
    entitySlug: "candidates",
    listHref: "/",
    detailHref: (id: string) => `/candidates/${id}`,
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/shared/hooks", () => ({
  useWorkspace: () => ({
    workspace: mocks.workspace,
    isLoading: mocks.isWorkspaceLoading,
  }),
  useActiveUseCaseLabels: () => ({
    entityPlural: "Candidates",
    entitySingular: "Candidate",
    routes: mocks.routes,
  }),
}));
vi.mock("@/features/prospects/contexts", () => ({
  usePanelStack: () => ({ depth: 0, currentPanel: null }),
  useProspectProfile: () => mocks.profile,
}));
vi.mock("@/features/prospects/ui/components/ProspectProfilePanel", () => ({
  ProspectProfilePanel: () => <p>Profile content</p>,
}));
vi.mock("@/features/prospects/ui/components/ProspectPanelRenderer", () => ({
  ProspectPanelRenderer: () => null,
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.router.replace.mockClear();
  mocks.workspace._id = "hiring";
  mocks.isWorkspaceLoading = false;
  mocks.profile.prospect.workspaceId = "hiring";
  mocks.profile.loading = false;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
test("workspace changes exit an old profile instead of canonicalizing its ID into the new workspace", async () => {
  await act(async () =>
    root.render(
      <UseCaseProspectPage entitySlug="candidates" prospectId="person-1" />
    )
  );
  expect(host.textContent).toContain("Profile content");
  mocks.workspace._id = "customers";
  await act(async () =>
    root.render(
      <UseCaseProspectPage entitySlug="prospects" prospectId="person-1" />
    )
  );
  expect(mocks.router.replace).toHaveBeenLastCalledWith("/");
  expect(host.textContent).not.toContain("Profile content");
});
test("canonicalizes a resolved profile within its own workspace", async () => {
  await act(async () =>
    root.render(
      <UseCaseProspectPage entitySlug="prospects" prospectId="person-1" />
    )
  );
  expect(mocks.router.replace).toHaveBeenCalledWith("/candidates/person-1");
});
test("waits for the route's prospect before canonicalizing", async () => {
  mocks.profile.loading = true;
  await act(async () =>
    root.render(
      <UseCaseProspectPage entitySlug="prospects" prospectId="person-1" />
    )
  );
  expect(mocks.router.replace).not.toHaveBeenCalled();
});
test("suppresses profile content while the workspace is resolving", async () => {
  mocks.isWorkspaceLoading = true;
  await act(async () =>
    root.render(
      <UseCaseProspectPage entitySlug="candidates" prospectId="person-1" />
    )
  );
  expect(host.textContent).not.toContain("Profile content");
  expect(mocks.router.replace).not.toHaveBeenCalled();
});
test("returns to the list when a profile has no verifiable workspace", async () => {
  mocks.profile.prospect.workspaceId = "";
  await act(async () =>
    root.render(
      <UseCaseProspectPage entitySlug="candidates" prospectId="person-1" />
    )
  );
  expect(host.textContent).not.toContain("Profile content");
  expect(mocks.router.replace).toHaveBeenCalledWith("/");
});
