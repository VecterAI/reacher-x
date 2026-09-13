"use client";

import { useEffect, useRef, useState } from "react";
import {
  DmComposer,
  DmComposerFrame,
} from "@/features/composer/ui/components/DmComposer";
import { DmConversationHeader } from "@/features/prospects/ui/components/DmConversationHeader";
import { LinkedInDmConversationMenu } from "@/features/prospects/ui/components/LinkedInDmConversationMenu";
import { LINKEDIN_DM_TEXT_MAX } from "@/shared/lib/linkedin/conversation";
import { extractTwitterUsername } from "@/shared/lib/utils/url/socialProfiles";
import { XDmConversationMenu } from "@/features/prospects/ui/components/XDmConversationMenu";
import { ConversationMessageViewport } from "@/features/prospects/ui/components/ConversationMessageViewport";
import { ConversationMessageList } from "@/features/prospects/ui/components/conversation-message/ConversationMessageList";
import type { RichConversationMessage } from "@/features/prospects/ui/components/conversation-message/types";
import type { ProspectProfileData } from "@/features/prospects/ui/components/ProspectProfilePanel";
import { PageLayout } from "@/features/webapp/ui/components/page/PageLayout";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { extractTextFromEditorState } from "@/shared/lib/utils";
import { X_DM_TEXT_MAX } from "@/shared/lib/twitter/xPostTextLimit";

const EXAMPLE_MESSAGES: RichConversationMessage[] = [
  {
    id: "demo-1",
    conversationId: "demo",
    direction: "sent",
    text: "I read your post about keyboard navigation. We're hiring a frontend engineer to do similar work on our app. Remote, a team of three, €80–100k. Can I send you the details?",
    createdAt: "2026-08-28T10:00:00Z",
  },
  {
    id: "demo-2",
    conversationId: "demo",
    direction: "received",
    text: "Thanks for being specific. Yes, I'd like to hear about the product and what I'd own.",
    createdAt: "2026-08-28T10:08:00Z",
  },
];
const noOlderMessages = () => {};

/** Only data and effects are mocked; presentation is shared with live DMs. */
export function DemoConversationPanel({
  prospect,
  onBack,
  onViewProfile,
  onViewPlatformProfile,
}: {
  prospect: ProspectProfileData;
  onBack: () => void;
  onViewProfile: () => void;
  onViewPlatformProfile: () => void;
}) {
  const [messages, setMessages] = useState<RichConversationMessage[]>(() =>
    prospect.id === "use_case_demo_candidates_1" &&
    prospect.title === "Senior frontend engineer"
      ? EXAMPLE_MESSAGES
      : []
  );
  const mediaObjectUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      mediaObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );
  const participant = {
    displayName: prospect.displayName ?? "Conversation",
    avatarUrl: prospect.avatarUrl ?? undefined,
  };
  return (
    <PageLayout className="flex h-full min-h-0 max-w-[520px] flex-col md:w-full md:max-w-[520px]">
      <DmConversationHeader
        participant={participant}
        platform={prospect.platform ?? "twitter"}
        onBack={onBack}
        actions={
          prospect.platform === "linkedin" ? (
            <LinkedInDmConversationMenu
              profileUrl={prospect.profileUrl}
              onViewProfile={onViewProfile}
              onViewLinkedInProfile={onViewPlatformProfile}
            />
          ) : (
            <XDmConversationMenu
              profileUrl={prospect.profileUrl}
              resolvedTwitterUsername={
                prospect.profileUrl
                  ? extractTwitterUsername(prospect.profileUrl)
                  : undefined
              }
              onViewProfile={onViewProfile}
              onViewTwitterProfile={onViewPlatformProfile}
            />
          )
        }
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <ConversationMessageViewport
          conversationKey={prospect.id}
          messageCount={messages.length}
          hasMore={false}
          isLoadingOlder={false}
          onLoadOlder={noOlderMessages}
          scrollToLatestRequest={messages.length}
        >
          <ConversationMessageList
            scrollerItems
            messages={messages}
            platform={prospect.platform ?? "twitter"}
            participantName={participant.displayName}
            participantAvatarUrl={participant.avatarUrl}
          />
        </ConversationMessageViewport>
        <DmComposerFrame>
          <DmComposer
            currentUser={{ name: "Alex", screenName: "alex" }}
            inlineAutocompleteContext={{ enabled: false }}
            maxLength={
              prospect.platform === "linkedin"
                ? LINKEDIN_DM_TEXT_MAX
                : X_DM_TEXT_MAX
            }
            allowedMediaKinds={
              prospect.platform === "linkedin"
                ? ["image", "gif", "video", "file"]
                : ["image", "gif", "video"]
            }
            maxAttachments={prospect.platform === "linkedin" ? 4 : 1}
            deferMediaUpload
            showOpenGraphPreview={false}
            onSubmit={(content, _urls, _descriptions, _kinds, uploads = []) => {
              const attachments = uploads.map((upload) => {
                // Own the preview separately from the composer's short-lived upload state.
                const url = URL.createObjectURL(upload.file);
                mediaObjectUrls.current.push(url);
                return {
                  type: upload.mediaKind,
                  url,
                  previewUrl: url,
                  fileName: upload.file.name,
                  mimeType: upload.file.type,
                  width: upload.width,
                  height: upload.height,
                  isGif: upload.mediaKind === "gif",
                };
              });
              const text = extractTextFromEditorState(content).trim();
              if (text || attachments.length)
                setMessages((current) => [
                  ...current,
                  {
                    id: `demo-${current.length + 1}`,
                    conversationId: "demo",
                    direction: "sent",
                    createdAt: new Date(getCurrentUTCTimestamp()).toISOString(),
                    text,
                    attachments,
                  },
                ]);
            }}
          />
        </DmComposerFrame>
      </div>
    </PageLayout>
  );
}
