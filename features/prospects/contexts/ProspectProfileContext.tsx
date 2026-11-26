/**
 * ProspectProfileContext
 * Manages prospect profile data loading and panel state.
 * Wraps PanelStackContext with data fetching capabilities.
 */
"use client";

import * as React from "react";
import { getClientErrorMessage } from "@/shared/lib/errors";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useActiveUseCaseLabels, useQueryWithStatus } from "@/shared/hooks";
import {
  type OpenReplyPanelParams,
  ReplyPanelProvider,
} from "@/shared/contexts/ReplyPanelContext";
import { PanelStackProvider, usePanelStack } from "./PanelStackContext";
import type { ProspectProfileData } from "../ui/components/ProspectProfilePanel";
import { normalizeProspectProfileData } from "../lib/normalizeProspectProfileData";

interface ProspectProfileContextValue {
  /** Currently selected prospect ID */
  prospectId: Id<"prospects"> | null;
  /** Prospect data (loaded from Convex) */
  prospect: ProspectProfileData | null;
  /** Current surface mode for the selected prospect panel */
  mode: "default";
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Open prospect profile panel */
  openProspect: (prospectId: Id<"prospects">) => void;
  /** Close the profile panel */
  closeProspect: () => void;
}

const ProspectProfileContext = React.createContext<
  ProspectProfileContextValue | undefined
>(undefined);

export function useProspectProfile() {
  const context = React.useContext(ProspectProfileContext);
  if (!context) {
    throw new Error(
      "useProspectProfile must be used within a ProspectProfileProvider"
    );
  }
  return context;
}

/**
 * Transform raw Convex prospect data to ProspectProfileData format
 */
function transformProspectData(raw: unknown): ProspectProfileData | null {
  return normalizeProspectProfileData(raw);
}

function ProspectProfileProviderInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { entitySingular } = useActiveUseCaseLabels();
  const entitySingularLower = entitySingular.toLowerCase();
  const { openRootPanel, clearStack, depth } = usePanelStack();
  const markProspectOpenedMutation = useMutation(
    api.prospectListFeed.markProspectOpened
  );
  const [selection, setSelection] = React.useState<{
    kind: "live";
    prospectId: Id<"prospects">;
  } | null>(null);
  const prospectId = selection?.prospectId ?? null;
  const mode = "default" as const;

  // Fetch prospect data when we have an ID
  const rawProspectQuery = useQueryWithStatus(
    api.prospects.getProspect,
    prospectId ? { prospectId } : "skip"
  );
  const rawProspect = rawProspectQuery.data;

  const loading = selection !== null && rawProspectQuery.isPending;
  const error = rawProspectQuery.isError
    ? getClientErrorMessage(
        rawProspectQuery.error,
        `Could not load this ${entitySingularLower}. Please try again.`
      )
    : rawProspect === null
      ? `${entitySingular} not found`
      : null;
  const prospect = rawProspect ? transformProspectData(rawProspect) : null;

  const openProspect = React.useCallback(
    (id: Id<"prospects">) => {
      if (typeof id !== "string" || id.trim().length === 0) {
        console.warn("[ProspectProfileContext] Ignoring invalid prospect ID", {
          prospectId: id,
        });
        return;
      }

      setSelection({ kind: "live", prospectId: id });
      openRootPanel("prospect-profile", { prospectId: id });
      void markProspectOpenedMutation({ prospectId: id });
    },
    [markProspectOpenedMutation, openRootPanel]
  );

  const closeProspect = React.useCallback(() => {
    clearStack();
    setSelection(null);
  }, [clearStack]);

  // Clear prospect ID when stack is empty
  React.useEffect(() => {
    if (depth === 0 && selection !== null) {
      setSelection(null);
    }
  }, [depth, selection]);

  const value = React.useMemo(
    () => ({
      prospectId,
      prospect,
      mode,
      loading,
      error,
      openProspect,
      closeProspect,
    }),
    [prospectId, prospect, mode, loading, error, openProspect, closeProspect]
  );

  return (
    <ProspectProfileContext.Provider value={value}>
      <ReplyPanelProviderWrapper prospectId={prospectId}>
        {children}
      </ReplyPanelProviderWrapper>
    </ProspectProfileContext.Provider>
  );
}

function ReplyPanelProviderWrapper({
  prospectId,
  children,
}: {
  prospectId: Id<"prospects"> | null;
  children: React.ReactNode;
}) {
  const { pushPanel } = usePanelStack();
  const openReplyPanel = React.useCallback(
    (params: OpenReplyPanelParams) => {
      pushPanel("post-compose", {
        ...params,
        prospectId: params.prospectId ?? prospectId ?? undefined,
      } as unknown as Record<string, unknown>);
    },
    [prospectId, pushPanel]
  );
  return (
    <ReplyPanelProvider value={openReplyPanel}>{children}</ReplyPanelProvider>
  );
}

/**
 * Provider that combines PanelStack + ProspectProfile contexts
 */
export function ProspectProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PanelStackProvider>
      <ProspectProfileProviderInner>{children}</ProspectProfileProviderInner>
    </PanelStackProvider>
  );
}
