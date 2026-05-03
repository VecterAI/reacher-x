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
  const { prospect, loading, openProspect } = useProspectProfile();
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

  if (!isWorkspaceLoading && !isCanonicalRoute) {
    return null;
  }

  if (!prospect && !loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="font-medium">{entitySingular} not found</p>
          <button
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
        prospect={prospect || undefined}
        loading={loading}
        onChatWithAgent={handleChatWithAgent}
        onBack={handleBack}
        disableMobileDrawer={true}
        className={cn(
          "h-full min-h-0 w-full shrink-0 overflow-hidden",
          hasSubPanel && "hidden md:block md:max-w-lg"
        )}
      />

      {hasSubPanel && (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ProspectPanelRenderer className="w-full" />
        </div>
      )}
    </div>
  );
}
