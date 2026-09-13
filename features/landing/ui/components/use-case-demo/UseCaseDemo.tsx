/**
 * UseCaseDemo
 * Interactive landing page demo: the real product shell and page
 * components running on per-use-case mock data. Sidebar navigation
 * switches between demo pages; terminology adapts to the active use case
 * via DemoShellContext. All state is local, no Convex.
 */
"use client";

import * as React from "react";
import {
  WorkspaceTransitionProvider,
  useWorkspaceTransition,
} from "@/features/webapp/contexts/WorkspaceTransitionContext";
import type { Doc } from "@/convex/_generated/dataModel";
import { ProfileProvider } from "@/features/profile/contexts/TwitterProfileContext";
import { PanelStackProvider } from "@/features/prospects/contexts/PanelStackContext";
import { getProspectSuccessEmptyStateCopy } from "@/features/prospects/lib/prospectEmptyStateCopy";
import { PillSelector } from "@/shared/ui/components/pill-navigation/PillSelector";
import { AccountBoxIcon, ArchiveIcon } from "@/shared/ui/components/icons";
import { getDemoUseCaseLabels } from "./demoLabels";
import { DemoShellProvider, getDemoWorkspaces } from "./demoShellContext";
import {
  getEditorialDemoDataset,
  type DemoEditorialScenario,
} from "./demoEditorialHelpers";
import type { DemoPresentation } from "./demoPresentationHelpers";
import { UseCaseDemoFrame } from "./UseCaseDemoFrame";
import { UseCaseDemoShell, type DemoPageKey } from "./UseCaseDemoShell";
import { DemoAgentOpsPage } from "./pages/DemoAgentOpsPage";
import { DemoAgentPage } from "./pages/DemoAgentPage";
import { DemoAnalyticsPage } from "./pages/DemoAnalyticsPage";
import { DemoConnectedAccountsPage } from "./pages/DemoAccountsPages";
import { DemoNotificationsPage } from "./pages/DemoNotificationsPage";
import { DemoPlansPage } from "./pages/DemoPlansPage";
import { DemoProspectStatusListPage } from "./pages/DemoProspectStatusListPage";
import { DemoProspectsPage } from "./pages/DemoProspectsPage";
import { DemoUsagePage } from "./pages/DemoUsagePage";
import { DemoWorkspacePage } from "./pages/DemoWorkspacePage";
import {
  getDemoNotifications,
  getDemoPendingNotificationCount,
  USE_CASE_DEMO_DATASETS,
  type UseCaseDemoKey,
} from "./useCaseDemoData";

export function UseCaseDemo() {
  const [activePage, setActivePage] = React.useState<DemoPageKey>("prospects");
  const [activeUseCase, setActiveUseCase] =
    React.useState<UseCaseDemoKey>("customers");
  return (
    <div>
      <PillSelector
        label="Use cases"
        value={activeUseCase}
        onValueChange={setActiveUseCase}
        items={USE_CASE_DEMO_DATASETS.map((entry) => ({
          value: entry.key,
          label: entry.label,
        }))}
      />
      <div className="mt-8">
        <UseCaseDemoFrame>
          <UseCaseDemoApp
            key={activeUseCase}
            initialUseCase={activeUseCase}
            initialPage={activePage}
            onPageChange={setActivePage}
          />
        </UseCaseDemoFrame>
      </div>
    </div>
  );
}

/** Shared app used by the home demo and the blog's fixed-viewport presentation. */
export function UseCaseDemoApp(
  props: React.ComponentProps<typeof UseCaseDemoAppSession>
) {
  return (
    <WorkspaceTransitionProvider>
      <UseCaseDemoAppSession {...props} />
    </WorkspaceTransitionProvider>
  );
}

function UseCaseDemoAppSession({
  initialUseCase = "customers",
  initialPage = "prospects",
  onPageChange,
  presentation,
  mixedWorkspaces = false,
  editorialScenario,
  onViewChange,
}: {
  initialUseCase?: UseCaseDemoKey;
  initialPage?: DemoPageKey;
  onPageChange?: (page: DemoPageKey) => void;
  presentation?: DemoPresentation;
  mixedWorkspaces?: boolean;
  editorialScenario?: DemoEditorialScenario;
  onViewChange?: (view: string) => void;
}) {
  const requestedUseCase = presentation?.useCase ?? initialUseCase;
  const initialDemoUseCase =
    mixedWorkspaces &&
    requestedUseCase !== "candidates" &&
    requestedUseCase !== "customers"
      ? "candidates"
      : requestedUseCase;
  const [activeUseCase, setActiveUseCase] = React.useState(initialDemoUseCase);
  const [activePage, setActivePage] = React.useState<DemoPageKey>(
    presentation?.page ?? initialPage
  );
  const [activeWorkspaceId, setWorkspaceId] = React.useState(
    () => getDemoWorkspaces(initialDemoUseCase)[0].id
  );
  const workspaces = React.useMemo(
    () =>
      mixedWorkspaces
        ? [
            {
              ...getDemoWorkspaces("candidates")[0],
              name:
                editorialScenario === "workspaces"
                  ? "Hire a designer"
                  : "Hire a frontend engineer",
            },
            {
              ...getDemoWorkspaces("customers")[0],
              name: "People to try the app",
            },
          ]
        : undefined,
    [mixedWorkspaces, editorialScenario]
  );
  const { startTransition, completeTransition } = useWorkspaceTransition();
  const switchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (switchTimer.current) clearTimeout(switchTimer.current);
    },
    []
  );
  const setActiveWorkspaceId = React.useCallback(
    (id: string) => {
      if (id === activeWorkspaceId || switchTimer.current) return;
      setWorkspaceId(id);
      startTransition("switching_workspace");
      switchTimer.current = setTimeout(() => {
        if (mixedWorkspaces)
          setActiveUseCase(
            id === getDemoWorkspaces("candidates")[0].id
              ? "candidates"
              : "customers"
          );
        completeTransition();
        switchTimer.current = null;
      }, 850);
    },
    [activeWorkspaceId, mixedWorkspaces, startTransition, completeTransition]
  );
  const baseDataset = React.useMemo(
    () => getEditorialDemoDataset(activeUseCase, editorialScenario),
    [activeUseCase, editorialScenario]
  );
  const [statusOverrides, setStatusOverrides] = React.useState<
    Partial<Record<string, Doc<"prospects">["status"]>>
  >(() =>
    presentation?.status && baseDataset.prospects[0]
      ? { [baseDataset.prospects[0]._id]: presentation.status }
      : {}
  );
  const dataset = React.useMemo(
    () => ({
      ...baseDataset,
      prospects: baseDataset.prospects.map((p) =>
        statusOverrides[p._id]
          ? {
              ...p,
              status: statusOverrides[p._id] ?? p.status,
              pipelineStage: statusOverrides[p._id] ?? p.pipelineStage,
            }
          : p
      ),
    }),
    [baseDataset, statusOverrides]
  );
  const updateDemoStatus = (id: string, status: Doc<"prospects">["status"]) =>
    setStatusOverrides((current) => ({ ...current, [id]: status }));
  const [agentProspectId, setAgentProspectId] = React.useState<string | null>(
    null
  );
  const openDemoAgent = (prospect: Doc<"prospects">) => {
    setAgentProspectId(prospect._id);
    setActivePage("agent");
    onViewChange?.("agent");
  };
  const labels = getDemoUseCaseLabels(activeUseCase);
  const entityPluralLower = labels.entityPlural.toLowerCase();
  const successLabelLower = labels.pageLabels.converts.toLowerCase();

  // Derived stage lists: the same people appear in later stages, mirroring
  // how real prospects move through the pipeline.
  const convertedProspects = React.useMemo(
    () => dataset.prospects.filter((p) => p.status === "converted"),
    [dataset]
  );
  const archivedProspects = React.useMemo(
    () => dataset.prospects.filter((p) => p.status === "archived"),
    [dataset]
  );

  const successEmptyStateCopy = React.useMemo(
    () =>
      getProspectSuccessEmptyStateCopy({
        entityPlural: labels.entityPlural,
        successLabel: labels.pageLabels.converts,
        stageLabels: labels.stageLabels,
      }),
    [labels]
  );

  const pageContent = (() => {
    switch (activePage) {
      case "prospects":
        return (
          <DemoProspectsPage
            key={activeUseCase}
            prospects={dataset.prospects}
            presentation={presentation}
            onStatusChange={updateDemoStatus}
            onOpenAgent={openDemoAgent}
            onViewChange={onViewChange}
            editorialScenario={editorialScenario}
          />
        );
      case "converts":
        return (
          <DemoProspectStatusListPage
            onStatusChange={updateDemoStatus}
            onOpenAgent={openDemoAgent}
            editorialScenario={editorialScenario}
            key={activeUseCase}
            status="converted"
            prospects={convertedProspects}
            title={labels.pageLabels.converts}
            searchPlaceholder={`Search ${successLabelLower}...`}
            emptyState={{
              title: successEmptyStateCopy.title,
              description: successEmptyStateCopy.description,
              icon: (
                <AccountBoxIcon className="fill-muted-foreground size-12" />
              ),
            }}
            entityLabelLower={successLabelLower}
          />
        );
      case "archives":
        return (
          <DemoProspectStatusListPage
            onStatusChange={updateDemoStatus}
            onOpenAgent={openDemoAgent}
            editorialScenario={editorialScenario}
            key={activeUseCase}
            status="archived"
            prospects={archivedProspects}
            title={labels.pageLabels.archives}
            searchPlaceholder={`Search archived ${entityPluralLower}...`}
            emptyState={{
              title: `No archived ${entityPluralLower}`,
              icon: <ArchiveIcon className="fill-muted-foreground size-12" />,
            }}
            entityLabelLower={`archived ${entityPluralLower}`}
          />
        );
      case "agent":
        return (
          <DemoAgentPage
            key={`${activeUseCase}:${agentProspectId}`}
            prospect={dataset.prospects.find((p) => p._id === agentProspectId)}
          />
        );
      case "agent_ops":
        return <DemoAgentOpsPage />;
      case "analytics":
        return <DemoAnalyticsPage />;
      case "plans":
        return <DemoPlansPage />;
      case "usage":
        return <DemoUsagePage />;
      case "settings":
        return <DemoConnectedAccountsPage />;
      case "workspace":
        return (
          <DemoWorkspacePage
            key={`${activeUseCase}:${activeWorkspaceId}`}
            initialTab={presentation?.workspaceTab}
            editorialScenario={editorialScenario}
          />
        );
      case "notifications":
        return (
          <DemoNotificationsPage
            key={activeUseCase}
            notifications={getDemoNotifications(dataset)}
            onBack={() => setActivePage("prospects")}
          />
        );
    }
  })();

  return (
    <ProfileProvider>
      <PanelStackProvider>
        <DemoShellProvider
          useCaseKey={activeUseCase}
          pendingNotificationCount={getDemoPendingNotificationCount(dataset)}
          activeWorkspaceId={activeWorkspaceId}
          setActiveWorkspaceId={setActiveWorkspaceId}
          workspaces={workspaces}
          initialWorkspaceMenuOpen={presentation?.workspaceMenu}
        >
          <UseCaseDemoShell
            activePage={activePage}
            onNavigate={(page) => {
              setActivePage(page);
              onPageChange?.(page);
              onViewChange?.(page);
            }}
          >
            {pageContent}
          </UseCaseDemoShell>
        </DemoShellProvider>
      </PanelStackProvider>
    </ProfileProvider>
  );
}
