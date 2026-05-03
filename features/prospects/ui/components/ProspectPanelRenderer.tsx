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
import { LinkedInProfilePanel } from "./LinkedInProfilePanel";
import { EvidencePostsPanel } from "./EvidencePostsPanel";
import { ConversationPanel } from "./ConversationPanel";
import { ReplyPanel } from "./ReplyPanel";
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
import type { Tweet } from "@/features/threads/types";
import type { TwitterPostSummary } from "@/shared/lib/twitter/contracts";
import type { UnifiedPost } from "@/shared/lib/platforms/types";

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
  const { currentPanel, popPanel, pushPanel, depth } = usePanelStack();
  const { prospect, loading, error } = useProspectProfile();
  const { isOpen: twitterProfileOpen, openProfile } = useProfile();
  const isClosingSubPanelRef = React.useRef(false);
  const wasTwitterProfileOpenRef = React.useRef(twitterProfileOpen);

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
            mode="default"
          />
        );

      case "twitter-profile": {
        const twitterProfileProspectId =
          (currentPanel.props.prospectId as string | undefined) ?? prospect?.id;
        return (
          <TwitterProfilePanel
            className={className}
            prospectId={twitterProfileProspectId}
            onOpenConversation={
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

      case "linkedin-profile":
        return (
          <LinkedInProfilePanel
            prospectId={
              (currentPanel.props.prospectId as string | undefined) ??
              prospect?.id
            }
            className={className}
            onBack={closeCurrentSubPanel}
            onOpenConversation={() => {
              pushPanel("platform-conversation", {
                prospectId:
                  (currentPanel.props.prospectId as string | undefined) ??
                  prospect?.id,
                platform: "linkedin",
              });
            }}
          />
        );

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
            initialTweet={
              currentPanel.props.initialTweet as
                | import("@/features/threads/types").Tweet
                | undefined
            }
            className={className}
            onBack={closeCurrentSubPanel}
          />
        );

      case "platform-conversation":
        return (
          ((currentPanel.props.platform as "twitter" | "linkedin" | undefined) ??
            prospect?.platform) === "linkedin" ? (
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
          )
        );

      default:
        return null;
    }
  };

  const panelContent = renderPanelContent();

  // On mobile, wrap sub-panels in a Drawer
  if (isMobile && isSubPanel && panelContent) {
    return (
      <Drawer open onOpenChange={(o) => !o && closeCurrentSubPanel()}>
        <DrawerContent className="mt-0 flex h-dvh max-h-dvh">
          <div className="flex h-full min-h-0 w-full flex-col">
            <div className="flex min-h-0 flex-1 flex-col">{panelContent}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return panelContent;
}
