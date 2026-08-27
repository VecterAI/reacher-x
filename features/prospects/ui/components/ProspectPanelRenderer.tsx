/**
 * ProspectPanelRenderer
 * Renders the appropriate panel based on the current panel stack state.
 * Designed to be placed in a layout or page where panels should appear.
 * On mobile, sub-panels are rendered in a Drawer.
 */
"use client";

import * as React from "react";
import {
  usePanelStack,
  type PanelEntry,
} from "../../contexts/PanelStackContext";
import { useProspectProfile } from "../../contexts/ProspectProfileContext";
import { ProspectProfilePanel } from "./ProspectProfilePanel";
import { ProspectAgentPanel } from "./ProspectAgentPanel";
import { LinkedInProfilePanel } from "./LinkedInProfilePanel";
import { EvidencePostsPanel } from "./EvidencePostsPanel";
import { ConversationPanel } from "./ConversationPanel";
import { ReplyPanel } from "./ReplyPanel";
import { TwitterPostPanel } from "./TwitterPostPanel";
import { XConversationPanel } from "./XConversationPanel";
import { LinkedInConversationPanel } from "./LinkedInConversationPanel";
import { useProfile } from "@/features/profile/contexts/TwitterProfileContext";
import { TwitterProfilePanel } from "@/features/profile/ui/components/TwitterProfilePanel";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { useActiveUseCaseLabels } from "@/shared/hooks";
import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import { Drawer, DrawerContent } from "@/shared/ui/components/Drawer";
import { LinkedInPostThreadPanel } from "@/features/webapp/ui/components";
import { AgentDynamicPanel } from "@/features/agent/ui/components/AgentDynamicPanel";
import type { Tweet } from "@/features/threads/types";
import type { TwitterPostSummary } from "@/shared/lib/twitter/contracts";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import type { LinkedInProfileIdentity } from "@/shared/lib/linkedin/profile";
import type { AgentPanelMode } from "@/features/agent/lib";

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
  const { entitySingular } = useActiveUseCaseLabels();
  const entitySingularLower = entitySingular.toLowerCase();
  const isMobile = useIsMobile();
  const { currentPanel, stack, popPanel, pushPanel, depth } = usePanelStack();
  const { prospect, loading, error } = useProspectProfile();
  const {
    isOpen: twitterProfileOpen,
    username: activeTwitterUsername,
    openProfile,
  } = useProfile();
  const isClosingSubPanelRef = React.useRef(false);
  const wasTwitterProfileOpenRef = React.useRef(twitterProfileOpen);
  const loadedTwitterProfilePanelRef = React.useRef<string | null>(null);

  const closeCurrentSubPanel = React.useCallback(() => {
    if (isClosingSubPanelRef.current) {
      return;
    }

    isClosingSubPanelRef.current = true;
    popPanel();

    queueMicrotask(() => {
      isClosingSubPanelRef.current = false;
    });
  }, [popPanel]);

  // Sync Twitter profile close with panel stack
  React.useEffect(() => {
    const wasOpen = wasTwitterProfileOpenRef.current;
    wasTwitterProfileOpenRef.current = twitterProfileOpen;

    if (
      wasOpen &&
      !twitterProfileOpen &&
      currentPanel?.type === "twitter-profile"
    ) {
      closeCurrentSubPanel();
    }
  }, [twitterProfileOpen, currentPanel, closeCurrentSubPanel]);

  React.useEffect(() => {
    if (currentPanel?.type !== "twitter-profile") {
      return;
    }

    const username = currentPanel.props.username as string | undefined;
    const initialTab = currentPanel.props.initialTab as
      | import("@/features/profile/contexts/TwitterProfileContext").ProfileMode
      | undefined;
    if (
      !username ||
      loadedTwitterProfilePanelRef.current === currentPanel.stackKey
    ) {
      return;
    }

    loadedTwitterProfilePanelRef.current = currentPanel.stackKey;
    if (!twitterProfileOpen || activeTwitterUsername !== username) {
      void openProfile({ username, initialTab });
    }
  }, [activeTwitterUsername, currentPanel, openProfile, twitterProfileOpen]);

  // Handle Chat with Agent navigation
  const handleChatWithAgent = React.useCallback(() => {
    if (prospect) {
      router.push(`/agent?prospectId=${prospect.id}`);
    }
  }, [prospect, router]);

  if (!currentPanel) {
    return null;
  }

  // Check if this is a sub-panel (not the main prospect-profile)
  const isSubPanel =
    currentPanel.type !== "prospect-profile" && (depth > 1 || isMobile);

  // Render the panel content based on type
  const renderPanelContent = (panelEntry: PanelEntry, isActive: boolean) => {
    const currentPanel = panelEntry;
    switch (currentPanel.type) {
      case "prospect-profile":
        if (error) {
          return (
            <div
              className={cn(
                "flex h-full items-center justify-center p-6",
                className
              )}
            >
              <div className="w-full max-w-sm rounded-xl border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  Could not load {entitySingularLower}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">{error}</p>
              </div>
            </div>
          );
        }
        return (
          <ProspectProfilePanel
            prospect={prospect || undefined}
            loading={loading}
            onChatWithAgent={handleChatWithAgent}
            className={className}
            // Inactive mobile layers must not keep a portalled Drawer mounted
            // above the active sub-panel. The renderer owns sub-panel drawers.
            disableMobileDrawer={!isActive}
            mode="default"
          />
        );

      case "prospect-agent": {
        const panelProspectId =
          (currentPanel.props.prospectId as string | undefined) ?? prospect?.id;

        if (!panelProspectId) {
          return null;
        }

        return (
          <ProspectAgentPanel
            prospectId={panelProspectId}
            className={className}
            onBack={closeCurrentSubPanel}
          />
        );
      }

      case "twitter-post":
        return (
          <TwitterPostPanel
            tweetId={currentPanel.props.tweetId as string}
            initialTweet={
              currentPanel.props.initialTweet as Tweet | null | undefined
            }
            className={className}
            onBack={closeCurrentSubPanel}
          />
        );

      case "twitter-profile": {
        const twitterProfileUsername = currentPanel.props.username as
          | string
          | undefined;
        const twitterProfileProspectId =
          (currentPanel.props.prospectId as string | undefined) ??
          (twitterProfileUsername ? undefined : prospect?.id);
        return (
          <TwitterProfilePanel
            className={className}
            prospectId={twitterProfileProspectId}
            disableMobileDrawer
            onOpenConversationAction={
              twitterProfileProspectId
                ? () => {
                    pushPanel("platform-conversation", {
                      prospectId: twitterProfileProspectId,
                      platform: "twitter",
                    });
                  }
                : undefined
            }
          />
        );
      }

      case "linkedin-profile": {
        const linkedInIdentity = currentPanel.props.identity as
          | LinkedInProfileIdentity
          | undefined;
        const linkedInProfileProspectId =
          (currentPanel.props.prospectId as string | undefined) ??
          (linkedInIdentity ? undefined : prospect?.id);
        return (
          <LinkedInProfilePanel
            prospectId={linkedInProfileProspectId}
            identity={linkedInIdentity}
            className={className}
            disableMobileDrawer
            onBack={closeCurrentSubPanel}
            onOpenConversation={
              linkedInProfileProspectId
                ? () => {
                    pushPanel("platform-conversation", {
                      prospectId: linkedInProfileProspectId,
                      platform: "linkedin",
                    });
                  }
                : undefined
            }
          />
        );
      }

      case "linkedin-post-thread":
        return (
          <LinkedInPostThreadPanel
            post={currentPanel.props.post as UnifiedPost}
            prospectId={prospect?.id}
            previewScenario={
              currentPanel.props.previewScenario as
                | import("@/features/webapp/ui/components").LinkedInCommentThreadPreviewScenario
                | undefined
            }
            initialSort={
              currentPanel.props.initialSort as
                | import("@/shared/lib/linkedin/comments").LinkedInCommentSort
                | undefined
            }
            autoExpandCommentIds={
              currentPanel.props.autoExpandCommentIds as string[] | undefined
            }
            onBack={closeCurrentSubPanel}
          />
        );

      case "evidence-posts":
        return (
          <EvidencePostsPanel
            prospectId={prospect?.id}
            title={currentPanel.props.title as string}
            posts={currentPanel.props.posts as unknown[]}
            platform={currentPanel.props.platform as "twitter" | "linkedin"}
            className={className}
            onBack={closeCurrentSubPanel}
          />
        );

      case "finance-source":
        // Same as evidence posts for now
        return (
          <EvidencePostsPanel
            prospectId={prospect?.id}
            title="Finance Source"
            posts={currentPanel.props.posts as unknown[]}
            platform={currentPanel.props.platform as "twitter" | "linkedin"}
            className={className}
            onBack={closeCurrentSubPanel}
          />
        );

      case "conversation":
        return (
          <ConversationPanel
            threadId={currentPanel.props.threadId as string}
            prospectId={prospect?.id}
            sourceTweetId={
              currentPanel.props.sourceTweetId as string | undefined
            }
            sourceTweet={
              currentPanel.props.sourceTweet as Tweet | null | undefined
            }
            sourceTweetSummary={
              currentPanel.props.sourceTweetSummary as
                | TwitterPostSummary
                | null
                | undefined
            }
            replyTweetId={currentPanel.props.replyTweetId as string | undefined}
            replyTweetSummary={
              currentPanel.props.replyTweetSummary as
                | TwitterPostSummary
                | null
                | undefined
            }
            fallbackTweets={
              currentPanel.props.fallbackTweets as Tweet[] | undefined
            }
            overlayCommented={
              currentPanel.props.overlayCommented as boolean | undefined
            }
            className={className}
            onBack={closeCurrentSubPanel}
          />
        );

      case "post-compose":
        return (
          <ReplyPanel
            tweetId={currentPanel.props.tweetId as string}
            threadId={currentPanel.props.threadId as string}
            prospectId={currentPanel.props.prospectId as string | undefined}
            initialTweet={
              currentPanel.props.initialTweet as
                | import("@/features/threads/types").Tweet
                | undefined
            }
            className={className}
            onBack={closeCurrentSubPanel}
          />
        );

      case "task-compose": {
        const taskProspectId =
          (currentPanel.props.prospectId as string | undefined) ?? prospect?.id;
        if (!taskProspectId) {
          return null;
        }

        return (
          <AgentDynamicPanel
            prospectId={taskProspectId}
            taskId={currentPanel.props.taskId as string | undefined}
            targetTweetId={
              currentPanel.props.targetTweetId as string | undefined
            }
            fallbackPost={
              currentPanel.props.fallbackPost as
                | {
                    platform: "twitter" | "linkedin";
                    postData?: unknown;
                    postRef?: import("@/shared/lib/twitter/contracts").TwitterPostRef;
                    postSummary?: import("@/shared/lib/twitter/contracts").TwitterPostSummary;
                  }
                | undefined
            }
            requestedMode={
              currentPanel.props.panelMode as AgentPanelMode | undefined
            }
            requestedKind={
              (currentPanel.props.requestedKind as "post" | "dm" | undefined) ??
              "post"
            }
            onClose={closeCurrentSubPanel}
            onViewProfile={() => {
              pushPanel("prospect-profile", {
                prospectId: taskProspectId,
              });
            }}
            onViewTwitterProfile={(username) => {
              void openProfile({ username });
              pushPanel("twitter-profile", {
                prospectId: taskProspectId,
                username,
              });
            }}
            className={className}
          />
        );
      }

      case "platform-conversation":
        return ((currentPanel.props.platform as
          | "twitter"
          | "linkedin"
          | undefined) ?? prospect?.platform) === "linkedin" ? (
          <LinkedInConversationPanel
            prospectId={
              (currentPanel.props.prospectId as string | undefined) ??
              prospect?.id ??
              ""
            }
            actionRequestId={
              currentPanel.props.actionRequestId as string | undefined
            }
            onBack={closeCurrentSubPanel}
            onViewProfile={() => {
              pushPanel("prospect-profile", {
                prospectId:
                  (currentPanel.props.prospectId as string | undefined) ??
                  prospect?.id,
              });
            }}
            onViewLinkedInProfile={() => {
              pushPanel("linkedin-profile", {
                prospectId:
                  (currentPanel.props.prospectId as string | undefined) ??
                  prospect?.id,
              });
            }}
            className={className}
          />
        ) : (
          <XConversationPanel
            prospectId={
              (currentPanel.props.prospectId as string | undefined) ??
              prospect?.id ??
              ""
            }
            actionRequestId={
              currentPanel.props.actionRequestId as string | undefined
            }
            onBack={closeCurrentSubPanel}
            onViewProfile={() => {
              pushPanel("prospect-profile", {
                prospectId:
                  (currentPanel.props.prospectId as string | undefined) ??
                  prospect?.id,
              });
            }}
            onViewTwitterProfile={(username) => {
              void openProfile({ username });
              pushPanel("twitter-profile", { username });
            }}
            className={className}
          />
        );

      default:
        return null;
    }
  };

  const panelLayers = stack.map((panelEntry, index) => {
    const isActive = index === stack.length - 1;
    return (
      <div
        key={panelEntry.stackKey}
        className={isActive ? "contents" : "hidden"}
        aria-hidden={!isActive}
      >
        {renderPanelContent(panelEntry, isActive)}
      </div>
    );
  });

  // On mobile, wrap sub-panels in a Drawer
  if (isMobile && isSubPanel && panelLayers.length > 0) {
    return (
      <Drawer open onOpenChange={(o) => !o && closeCurrentSubPanel()}>
        <DrawerContent className="mt-0 flex h-dvh max-h-dvh">
          <div className="flex h-full min-h-0 w-full flex-col">
            <div className="flex min-h-0 flex-1 flex-col">{panelLayers}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return panelLayers;
}
