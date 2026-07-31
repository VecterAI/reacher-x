/**
 * UseCaseDemo
 * Interactive landing page demo: the real product shell and page
 * components running on per-use-case mock data. Sidebar navigation
 * switches between demo pages; terminology adapts to the active use case
 * via DemoShellContext. All state is local, no Convex.
 */
"use client";

import * as React from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { ProfileProvider } from "@/features/profile/contexts/TwitterProfileContext";
import { PanelStackProvider } from "@/features/prospects/contexts/PanelStackContext";
import { getProspectSuccessEmptyStateCopy } from "@/features/prospects/lib/prospectEmptyStateCopy";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui/components/ToggleGroup";
import { AccountBoxIcon, ArchiveIcon } from "@/shared/ui/components/icons";
import { getDemoUseCaseLabels } from "./demoLabels";
import { DemoShellProvider, getDemoWorkspaces } from "./demoShellContext";
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

function withStatus(
  prospects: Doc<"prospects">[],
  status: "converted" | "archived"
): Doc<"prospects">[] {
  return prospects.map((prospect) => ({ ...prospect, status }));
}

export function UseCaseDemo() {
  const [activeUseCase, setActiveUseCase] =
    React.useState<UseCaseDemoKey>("customers");
  const [activePage, setActivePage] = React.useState<DemoPageKey>("prospects");
  const [activeWorkspaceId, setActiveWorkspaceId] = React.useState(
    getDemoWorkspaces("customers")[0].id
  );

  const dataset =
    USE_CASE_DEMO_DATASETS.find((entry) => entry.key === activeUseCase) ??
    USE_CASE_DEMO_DATASETS[0];
  const labels = getDemoUseCaseLabels(activeUseCase);
  const entityPluralLower = labels.entityPlural.toLowerCase();
  const successLabelLower = labels.pageLabels.converts.toLowerCase();

  // Derived stage lists: the same people appear in later stages, mirroring
  // how real prospects move through the pipeline.
  const convertedProspects = React.useMemo(
    () => withStatus(dataset.prospects.slice(0, 3), "converted"),
    [dataset]
  );
  const archivedProspects = React.useMemo(
    () => withStatus(dataset.prospects.slice(3, 5), "archived"),
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
          />
        );
      case "converts":
        return (
          <DemoProspectStatusListPage
            key={activeUseCase}
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
            key={activeUseCase}
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
        return <DemoAgentPage key={activeUseCase} />;
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
          <DemoWorkspacePage key={`${activeUseCase}:${activeWorkspaceId}`} />
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
    <div>
      {/* Use case switcher (landing chrome, not part of the mock UI) */}
      <div className="scroll-fade-x scrollbar-none overflow-x-auto [overflow-y:clip] [&::-webkit-scrollbar]:hidden">
        <ToggleGroup
          type="single"
          value={activeUseCase}
          variant="outline"
          size="sm"
          className="w-max justify-start gap-1"
          aria-label="Use cases"
          onValueChange={(value) => {
            if (!value) return;
            setActiveUseCase(value as UseCaseDemoKey);
          }}
        >
          {USE_CASE_DEMO_DATASETS.map((entry) => (
            <ToggleGroupItem
              key={entry.key}
              value={entry.key}
              className="bg-background text-muted-foreground data-[state=on]:border-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:hover:bg-accent data-[state=on]:hover:text-accent-foreground rounded-full px-2.5"
            >
              {entry.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="mt-8">
        <UseCaseDemoFrame>
          <ProfileProvider>
            <PanelStackProvider>
              <DemoShellProvider
                useCaseKey={activeUseCase}
                pendingNotificationCount={getDemoPendingNotificationCount(
                  dataset
                )}
                activeWorkspaceId={activeWorkspaceId}
                setActiveWorkspaceId={setActiveWorkspaceId}
              >
                <UseCaseDemoShell
                  activePage={activePage}
                  onNavigate={setActivePage}
                >
                  {pageContent}
                </UseCaseDemoShell>
              </DemoShellProvider>
            </PanelStackProvider>
          </ProfileProvider>
        </UseCaseDemoFrame>
      </div>
    </div>
  );
}
