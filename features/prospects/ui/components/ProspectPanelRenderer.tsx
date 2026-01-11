/**
 * ProspectPanelRenderer
 * Renders the appropriate panel based on the current panel stack state.
 * Designed to be placed in a layout or page where panels should appear.
 * On mobile, sub-panels are rendered in a Drawer.
 */
"use client";

import * as React from "react";
import { usePanelStack } from "../../contexts/PanelStackContext";
import { useProspectProfile } from "../../contexts/ProspectProfileContext";
import { ProspectProfilePanel } from "./ProspectProfilePanel";
import { EvidencePostsPanel } from "./EvidencePostsPanel";
import { ConversationPanel } from "./ConversationPanel";
import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
import { TwitterProfilePanel } from "@/features/profile/ui/components/TwitterProfilePanel";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { Drawer, DrawerContent } from "@/shared/ui/components/Drawer";

export interface ProspectPanelRendererProps {
  /** className for the panel container */
  className?: string;
}

/**
 * Renders the panel stack - shows the current (top) panel
 * On mobile, sub-panels (evidence, finance, twitter) are rendered inside a Drawer
 */
export function ProspectPanelRenderer({
  className,
}: ProspectPanelRendererProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { currentPanel, popPanel, pushPanel, depth } = usePanelStack();
  const { prospect, loading } = useProspectProfile();
  const { openProfile, isOpen: twitterProfileOpen } = useProfile();

  // Handle Twitter profile navigation
  const handleTwitterClick = React.useCallback(
    (username: string) => {
      // Use existing TwitterProfileContext to open the profile
      openProfile({ username });
      pushPanel("twitter-profile", { username });
    },
    [openProfile, pushPanel]
  );

  // Sync Twitter profile close with panel stack
  React.useEffect(() => {
    if (!twitterProfileOpen && currentPanel?.type === "twitter-profile") {
      popPanel();
    }
  }, [twitterProfileOpen, currentPanel, popPanel]);

  // Handle Chat with Agent navigation
  const handleChatWithAgent = React.useCallback(() => {
    if (prospect) {
      router.push(`/agent?prospectId=${prospect.id}`);
    }
  }, [router, prospect]);

  if (!currentPanel) {
    return null;
  }

  // Check if this is a sub-panel (not the main prospect-profile)
  const isSubPanel = depth > 1 && currentPanel.type !== "prospect-profile";

  // Render the panel content based on type
  const renderPanelContent = () => {
    switch (currentPanel.type) {
      case "prospect-profile":
        return (
          <ProspectProfilePanel
            prospect={prospect || undefined}
            loading={loading}
            onChatWithAgent={handleChatWithAgent}
            className={className}
          />
        );

      case "twitter-profile":
        return <TwitterProfilePanel className={className} />;

      case "evidence-posts":
        return (
          <EvidencePostsPanel
            title={currentPanel.props.title as string}
            posts={currentPanel.props.posts as unknown[]}
            platform={currentPanel.props.platform as "twitter" | "linkedin"}
            className={className}
          />
        );

      case "finance-source":
        // Same as evidence posts for now
        return (
          <EvidencePostsPanel
            title="Finance Source"
            posts={currentPanel.props.posts as unknown[]}
            platform={currentPanel.props.platform as "twitter" | "linkedin"}
            className={className}
          />
        );

      case "conversation":
        return (
          <ConversationPanel
            threadId={currentPanel.props.threadId as string}
            className={className}
          />
        );

      default:
        return null;
    }
  };

  const panelContent = renderPanelContent();

  // On mobile, wrap sub-panels in a Drawer
  if (isMobile && isSubPanel && panelContent) {
    return (
      <Drawer open onOpenChange={(o) => !o && popPanel()}>
        <DrawerContent className="mt-0 flex h-dvh max-h-dvh">
          <div className="flex h-full w-full flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">{panelContent}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return panelContent;
}
