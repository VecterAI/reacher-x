"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { ProspectProfilePanel } from "@/features/prospects/ui/components/ProspectProfilePanel";
import { ProspectPanelRenderer } from "@/features/prospects/ui/components/ProspectPanelRenderer";
import {
  usePanelStack,
  useProspectProfile,
} from "@/features/prospects/contexts";
import { useActiveUseCaseLabels, useWorkspace } from "@/shared/hooks";
import { cn } from "@/shared/lib/utils";

interface UseCaseProspectPageProps {
  entitySlug: string;
  prospectId: string;
}

export function UseCaseProspectPage({
  entitySlug,
  prospectId,
}: UseCaseProspectPageProps) {
  const router = useRouter();
  const { entityPlural, entitySingular, routes } = useActiveUseCaseLabels();
  const { isLoading: isWorkspaceLoading } = useWorkspace();
  const { currentPanel, depth } = usePanelStack();
  const {
    prospectId: selectedProspectId,
    prospect,
    loading,
    openProspect,
  } = useProspectProfile();
  const entityPluralLower = entityPlural.toLowerCase();
  const isCanonicalRoute = entitySlug === routes.entitySlug;

  useEffect(() => {
    if (prospectId) {
      openProspect(prospectId as Id<"prospects">);
    }
  }, [openProspect, prospectId]);

  useEffect(() => {
    if (!isWorkspaceLoading && !isCanonicalRoute) {
      router.replace(routes.detailHref(prospectId));
    }
  }, [isCanonicalRoute, isWorkspaceLoading, prospectId, router, routes]);

  const handleChatWithAgent = () => {
    if (prospectId) {
      router.push(`/agent?prospectId=${prospectId}`);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const hasSubPanel = depth >= 1 && currentPanel?.type !== "prospect-profile";
  const isResolvingRouteProspect = selectedProspectId !== prospectId || loading;
  const routeProspect =
    selectedProspectId === prospectId ? prospect : undefined;

  if (!isWorkspaceLoading && !isCanonicalRoute) {
    return null;
  }

  if (!routeProspect && !isResolvingRouteProspect) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="font-medium">{entitySingular} not found</p>
          <button
            type="button"
            onClick={handleBack}
            className="text-primary mt-2 text-sm hover:underline"
          >
            Back to {entityPluralLower}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      <ProspectProfilePanel
        prospect={routeProspect || undefined}
        loading={isResolvingRouteProspect}
        onChatWithAgent={handleChatWithAgent}
        onBack={handleBack}
        disableMobileDrawer={true}
        className={cn(
          "h-full min-h-0 w-full shrink-0 overflow-hidden border-x-0 [&_[data-page-layout]]:border-x-0",
          "md:border-border md:border-r",
          hasSubPanel && "hidden md:block md:max-w-lg"
        )}
      />

      {hasSubPanel && (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ProspectPanelRenderer className="w-full max-w-none border-x-0 md:border-l-0 [&_[data-page-layout]]:max-w-none [&_[data-page-layout]]:border-x-0" />
        </div>
      )}
    </div>
  );
}
