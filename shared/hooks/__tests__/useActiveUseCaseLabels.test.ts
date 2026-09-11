// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import {
  ActiveUseCaseLabelsProvider,
  ScopedUseCaseLabelsProvider,
} from "../../contexts/ActiveUseCaseLabelsProvider";
import { useActiveUseCaseLabels } from "../useActiveUseCaseLabels";
const state = vi.hoisted(() => ({
  workspace: { useCaseKey: "customer_prospecting" } as {
    useCaseKey: string;
  } | null,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/home/demo/example" }));
vi.mock("../useWorkspace", () => ({
  useWorkspace: () => ({ workspace: state.workspace }),
}));
vi.mock("../useSetupThreadDraft", () => ({
  useSetupThreadDraft: () => ({ setupDraft: null }),
}));
vi.mock("@nanostores/react", () => ({ useStore: () => null }));
vi.mock("@/shared/lib/workspaceUseCaseCache", () => ({
  getWorkspaceUseCaseLocalStorageSnapshot: () => null,
  getWorkspaceUseCaseLocalStorageServerSnapshot: () => null,
  subscribeWorkspaceUseCaseLocalStorage: () => () => {},
}));
function Labels() {
  const labels = useActiveUseCaseLabels();
  return createElement(
    "p",
    null,
    `${labels.entitySingular}|${labels.stageLabels.in_progress}|${labels.stageLabels.converted}`
  );
}
beforeEach(() => {
  state.workspace = { useCaseKey: "customer_prospecting" };
});
test("a demo scope overrides an authenticated workspace only inside its subtree", () => {
  const html = renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(ScopedUseCaseLabelsProvider, {
        useCaseKey: "recruiting",
        children: createElement(Labels),
      }),
      createElement(Labels)
    )
  );
  expect(html).toContain("Candidate|Interviewing|Hired");
  expect(html).toContain("Prospect|In progress|Converted");
});
test("the normal provider still prefers the live workspace over initial labels", () => {
  const html = renderToStaticMarkup(
    createElement(ActiveUseCaseLabelsProvider, {
      initialUseCaseKey: "recruiting",
      children: createElement(Labels),
    })
  );
  expect(html).toContain("Prospect|In progress|Converted");
});
test("the normal provider still supplies initial labels before the workspace loads", () => {
  state.workspace = null;
  const html = renderToStaticMarkup(
    createElement(ActiveUseCaseLabelsProvider, {
      initialUseCaseKey: "recruiting",
      children: createElement(Labels),
    })
  );
  expect(html).toContain("Candidate|Interviewing|Hired");
});
