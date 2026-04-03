/**
 * ProspectProfileContext
 * Manages prospect profile data loading and panel state.
 * Wraps PanelStackContext with data fetching capabilities.
 */
"use client";

import * as React from "react";
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
  const { pushPanel, clearStack, depth } = usePanelStack();
  const markProspectOpenedMutation = useMutation(
    api.prospectListFeed.markProspectOpened
  );
  const [prospectId, setProspectId] = React.useState<Id<"prospects"> | null>(
    null
  );

  // Fetch prospect data when we have an ID
  const rawProspectQuery = useQueryWithStatus(
    api.prospects.getProspect,
    prospectId ? { prospectId } : "skip"
  );
  const rawProspect = rawProspectQuery.data;

  const loading = prospectId !== null && rawProspectQuery.isPending;
  const error = rawProspectQuery.isError
    ? rawProspectQuery.error.message || `Failed to load ${entitySingularLower}`
    : rawProspect === null
      ? `${entitySingular} not found`
      : null;
  const prospect = rawProspect ? transformProspectData(rawProspect) : null;

  const openProspect = React.useCallback(
    (id: Id<"prospects">) => {
      setProspectId(id);
      pushPanel("prospect-profile", { prospectId: id });
      void markProspectOpenedMutation({ prospectId: id });
    },
    [markProspectOpenedMutation, pushPanel]
  );

  const closeProspect = React.useCallback(() => {
    clearStack();
    setProspectId(null);
  }, [clearStack]);

  // Clear prospect ID when stack is empty
  React.useEffect(() => {
    if (depth === 0 && prospectId !== null) {
      setProspectId(null);
    }
  }, [depth, prospectId]);

  const value = React.useMemo(
    () => ({
      prospectId,
      prospect,
      loading,
      error,
      openProspect,
      closeProspect,
    }),
    [prospectId, prospect, loading, error, openProspect, closeProspect]
  );

  return (
    <ProspectProfileContext.Provider value={value}>
      {children}
    </ProspectProfileContext.Provider>
  );
}

function ReplyPanelProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { replacePanel } = usePanelStack();
  const openReplyPanel = React.useCallback(
    (params: OpenReplyPanelParams) => {
      replacePanel(
        "post-compose",
        params as unknown as Record<string, unknown>
      );
    },
    [replacePanel]
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
      <ReplyPanelProviderWrapper>
        <ProspectProfileProviderInner>{children}</ProspectProfileProviderInner>
      </ReplyPanelProviderWrapper>
    </PanelStackProvider>
  );
}
