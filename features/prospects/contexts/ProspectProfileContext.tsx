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
  /** Current surface mode for the selected prospect panel */
  mode: "default" | "ui_preview";
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Open prospect profile panel */
  openProspect: (prospectId: Id<"prospects">) => void;
  /** Open a local UI preview prospect profile */
  openPreviewProspect: (prospect: ProspectProfileData) => void;
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
  const [selection, setSelection] = React.useState<
    | { kind: "live"; prospectId: Id<"prospects"> }
    | { kind: "preview"; prospect: ProspectProfileData }
    | null
  >(null);
  const prospectId =
    selection?.kind === "live"
      ? selection.prospectId
      : selection?.kind === "preview"
        ? (selection.prospect.id as Id<"prospects">)
        : null;
  const mode: "default" | "ui_preview" =
    selection?.kind === "preview" ? "ui_preview" : "default";

  // Fetch prospect data when we have an ID
  const rawProspectQuery = useQueryWithStatus(
    api.prospects.getProspect,
    selection?.kind === "live" && prospectId ? { prospectId } : "skip"
  );
  const rawProspect = rawProspectQuery.data;

  const loading = selection?.kind === "live" && rawProspectQuery.isPending;
  const error = rawProspectQuery.isError
    ? rawProspectQuery.error.message || `Failed to load ${entitySingularLower}`
    : rawProspect === null
      ? `${entitySingular} not found`
      : null;
  const prospect =
    selection?.kind === "preview"
      ? selection.prospect
      : rawProspect
        ? transformProspectData(rawProspect)
        : null;

  const openProspect = React.useCallback(
    (id: Id<"prospects">) => {
      setSelection({ kind: "live", prospectId: id });
      pushPanel("prospect-profile", { prospectId: id });
      void markProspectOpenedMutation({ prospectId: id });
    },
    [markProspectOpenedMutation, pushPanel]
  );

  const openPreviewProspect = React.useCallback(
    (prospect: ProspectProfileData) => {
      setSelection({ kind: "preview", prospect });
      pushPanel("prospect-profile", {
        prospectId: prospect.id,
        preview: true,
      });
    },
    [pushPanel]
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
      openPreviewProspect,
      closeProspect,
    }),
    [
      prospectId,
      prospect,
      mode,
      loading,
      error,
      openProspect,
      openPreviewProspect,
      closeProspect,
    ]
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
