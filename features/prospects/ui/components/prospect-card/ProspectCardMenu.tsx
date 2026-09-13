/**
 * ProspectCardMenu
 * Dropdown menu with platform-specific actions and status management.
 */
"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { ProspectCardMenuView } from "./ProspectCardMenuView";
import { usePanelStack } from "@/features/prospects/contexts/PanelStackContext";
import { useProspectProfile } from "@/features/prospects/contexts/ProspectProfileContext";
import { useProspectDmState } from "@/features/prospects/hooks/useProspectDmState";
import { getProspectStatusMenuOptions } from "@/features/prospects/lib/statusMenuOptions";
import { extractTwitterUsername } from "@/shared/lib/utils/url/socialProfiles";
import { toast } from "sonner";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { useTwitterProfileNavigation } from "@/features/webapp/ui/components/tweet/useTwitterProfileNavigation";
import { useLinkedInProfileNavigation } from "@/features/webapp/ui/components/linkedin/useLinkedInProfileNavigation";

import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";

type ProspectStatus = Doc<"prospects">["status"];

export interface ProspectCardMenuActions {
  useCaseKey: WorkspaceUseCaseKey;
  onStatusChange: (status: ProspectStatus) => void;
  onOpenConversation: () => void;
  onOpenAgent: () => void;
  onViewPlatformProfile: () => void;
  onShareProfile: () => void;
}

interface ProspectCardMenuProps {
  actions?: ProspectCardMenuActions;
  prospectId: Id<"prospects">;
  platform: "twitter" | "linkedin";
  profileUrl?: string;
  twitterUsername?: string;
  status: ProspectStatus;
  mode?: "default" | "onboarding_preview" | "ui_preview";
  onViewProfile: () => void;
  /** Called immediately when status is changed (for optimistic updates) */
  onStatusChange?: (newStatus: ProspectStatus) => void;
}

function LiveProspectCardMenu({
  prospectId,
  platform,
  profileUrl,
  twitterUsername,
  status,
  mode = "default",
  onViewProfile,
  onStatusChange,
}: ProspectCardMenuProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { openProfile } = useTwitterProfileNavigation();
  const openLinkedInProfile = useLinkedInProfileNavigation();
  const { pushPanel } = usePanelStack();
  const { openProspect } = useProspectProfile();
  const updateStatus = useMutation(api.prospects.updateProspectStatus);
  const {
    activeUseCaseKey,
    entityPlural,
    entitySingular,
    routes,
    stageLabels,
  } = useActiveUseCaseLabels();
  const statusOptions = React.useMemo(
    () => getProspectStatusMenuOptions(activeUseCaseKey),
    [activeUseCaseKey]
  );
  const resolvedTwitterUsername =
    platform === "twitter"
      ? twitterUsername ||
        (profileUrl ? extractTwitterUsername(profileUrl) : undefined)
      : undefined;
  const isOnboardingPreview = mode === "onboarding_preview";
  const isPreviewMode = mode !== "default";
  const dmState = useProspectDmState(String(prospectId), {
    enabled: menuOpen && !isPreviewMode,
    platform,
  });
  const dmEligibility = React.useMemo(() => {
    if (mode === "ui_preview") {
      return {
        enabled: true,
        reasonLabel: "Open the preview conversation.",
      };
    }
    return (
      dmState.data?.eligibility ?? {
        enabled: false,
        reasonLabel: dmState.loading
          ? platform === "linkedin"
            ? "Checking LinkedIn messaging availability..."
            : "Checking DM availability on X/Twitter..."
          : platform === "linkedin"
            ? "LinkedIn messaging eligibility unavailable right now."
            : "DM eligibility unavailable right now.",
      }
    );
  }, [dmState.data?.eligibility, dmState.loading, mode, platform]);

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewProfile();
  };

  const handleShareProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Copy internal prospect profile URL
    const prospectUrl = `${window.location.origin}${routes.detailHref(prospectId)}`;
    navigator.clipboard.writeText(prospectUrl).then(
      () =>
        toast.success("Copied!", {
          description: `${entitySingular} profile link copied.`,
        }),
      () => toast.error("Error!", { description: "Unable to copy." })
    );
  };

  const handleStatusChange = (
    e: React.MouseEvent,
    newStatus: ProspectStatus
  ) => {
    e.stopPropagation();

    // Call optimistic update callback immediately
    onStatusChange?.(newStatus);

    const statusLabel = stageLabels[newStatus];

    // Use toast.promise for immediate feedback
    toast.promise(updateStatus({ prospectId, status: newStatus }), {
      loading: `Marking as ${statusLabel}...`,
      success: `${entitySingular} marked as ${statusLabel}`,
      error: "Failed to update status",
    });
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Call optimistic update callback immediately
    onStatusChange?.("archived");

    toast.promise(updateStatus({ prospectId, status: "archived" }), {
      loading: "Archiving...",
      success: `${entitySingular} moved to archive`,
      error: "Failed to archive",
    });
  };

  const handleUnarchive = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Call optimistic update callback immediately
    onStatusChange?.("new");

    toast.promise(updateStatus({ prospectId, status: "new" }), {
      loading: "Unarchiving...",
      success: `${entitySingular} restored to ${entityPlural.toLowerCase()}`,
      error: "Failed to unarchive",
    });
  };

  const handleViewPlatformProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPreviewMode) {
      const fallbackUrl =
        profileUrl ||
        (platform === "twitter" && resolvedTwitterUsername
          ? `https://x.com/${resolvedTwitterUsername}`
          : undefined);
      if (fallbackUrl) {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (platform === "twitter" && resolvedTwitterUsername) {
      void openProfile({ username: resolvedTwitterUsername });
    } else if (platform === "linkedin" && profileUrl) {
      openLinkedInProfile(
        {
          entityType: /\/(company|school)\//i.test(profileUrl)
            ? "company"
            : "person",
          profileUrl,
        },
        String(prospectId)
      );
    }
  };

  const handleCopyProfileLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl).then(
      () => toast.success("Copied!", { description: "Profile link copied." }),
      () => toast.error("Error!", { description: "Unable to copy." })
    );
  };

  const handleOpenDmPanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    openProspect(prospectId);
    pushPanel("platform-conversation", {
      prospectId: String(prospectId),
      platform,
    });
  };

  const handleOpenAgentPanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/agent?prospectId=${prospectId}`);
  };

  return (
    <ProspectCardMenuView
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      platform={platform}
      profileUrl={profileUrl}
      resolvedTwitterUsername={resolvedTwitterUsername}
      status={status}
      statusOptions={statusOptions}
      isPreviewMode={isPreviewMode}
      isOnboardingPreview={isOnboardingPreview}
      dmEligibility={dmEligibility}
      handleOpenAgentPanel={handleOpenAgentPanel}
      handleViewProfile={handleViewProfile}
      handleShareProfile={handleShareProfile}
      handleStatusChange={handleStatusChange}
      handleViewPlatformProfile={handleViewPlatformProfile}
      handleCopyProfileLink={handleCopyProfileLink}
      handleOpenDmPanel={handleOpenDmPanel}
      handleArchive={handleArchive}
      handleUnarchive={handleUnarchive}
    />
  );
}

export function ProspectCardMenu(props: ProspectCardMenuProps) {
  return props.actions ? (
    <LocalProspectCardMenu {...props} actions={props.actions} />
  ) : (
    <LiveProspectCardMenu {...props} />
  );
}

function LocalProspectCardMenu({
  actions,
  onViewProfile,
  platform,
  profileUrl,
  twitterUsername,
  status,
}: ProspectCardMenuProps & { actions: ProspectCardMenuActions }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const handle =
    (action: () => void): React.MouseEventHandler =>
    (event) => {
      event.stopPropagation();
      action();
    };
  return (
    <ProspectCardMenuView
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      platform={platform}
      profileUrl={profileUrl}
      resolvedTwitterUsername={
        twitterUsername ||
        (profileUrl ? extractTwitterUsername(profileUrl) : undefined)
      }
      status={status}
      statusOptions={getProspectStatusMenuOptions(actions.useCaseKey)}
      isPreviewMode={false}
      isOnboardingPreview={false}
      dmEligibility={{ enabled: true }}
      handleOpenAgentPanel={handle(actions.onOpenAgent)}
      handleViewProfile={handle(onViewProfile)}
      handleShareProfile={handle(actions.onShareProfile)}
      handleStatusChange={(event, value) => {
        event.stopPropagation();
        actions.onStatusChange(value);
      }}
      handleViewPlatformProfile={handle(actions.onViewPlatformProfile)}
      handleCopyProfileLink={handle(() => {
        if (profileUrl)
          navigator.clipboard.writeText(profileUrl).then(
            () =>
              toast.success("Copied!", { description: "Profile link copied." }),
            () => toast.error("Error!", { description: "Unable to copy." })
          );
      })}
      handleOpenDmPanel={handle(actions.onOpenConversation)}
      handleArchive={handle(() => actions.onStatusChange("archived"))}
      handleUnarchive={handle(() => actions.onStatusChange("new"))}
    />
  );
}
