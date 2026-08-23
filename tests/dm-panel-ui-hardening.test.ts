import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

test("both DM panels share the Agent Chat message-scroller behavior", () => {
  const viewport = read(
    "features/prospects/ui/components/ConversationMessageViewport.tsx"
  );
  const linkedInPanel = read(
    "features/prospects/ui/components/LinkedInConversationPanel.tsx"
  );
  const xPanel = read(
    "features/prospects/ui/components/XConversationPanel.tsx"
  );

  assert.match(viewport, /MessageScrollerProvider/);
  assert.match(viewport, /autoScroll/);
  assert.match(viewport, /defaultScrollPosition="end"/);
  assert.match(viewport, /preserveScrollOnPrepend/);
  assert.match(viewport, /scrollToEnd\(\{ behavior: "smooth" \}\)/);
  assert.match(viewport, /new IntersectionObserver/);
  assert.match(viewport, /requestedHistoryKeyRef/);
  assert.match(viewport, /className="overflow-x-clip"/);
  assert.match(viewport, /"gap-0 px-4 pt-4 pb-16"/);
  assert.doesNotMatch(viewport, /\[mask-image:none\]/);
  assert.doesNotMatch(viewport, /\[-webkit-mask-image:none\]/);
  assert.doesNotMatch(viewport, /data-initial-position-ready/);
  assert.doesNotMatch(viewport, /new ResizeObserver/);
  assert.doesNotMatch(viewport, /"invisible"/);

  for (const panel of [linkedInPanel, xPanel]) {
    assert.match(panel, /<ConversationMessageViewport/);
    assert.match(panel, /scrollToLatestRequest/);
    assert.match(panel, /scrollerItems/);
    assert.match(
      panel,
      /bg-background shrink-0 px-4 pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\] backdrop-blur-xl/
    );
    assert.doesNotMatch(
      panel,
      /bg-background shrink-0 px-4 pt-2 pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\] backdrop-blur-xl/
    );
    assert.doesNotMatch(panel, /<ScrollArea/);
    assert.doesNotMatch(panel, /<ConversationHistoryPagination/);
  }
  assert.doesNotMatch(xPanel, /previousXChatUnlockRef/);
  assert.doesNotMatch(xPanel, /const justUnlocked =/);
});

test("XChat unlocks as soon as a complete PIN is entered", () => {
  const unlock = read(
    "features/prospects/ui/components/XChatConversationUnlock.tsx"
  );
  const gate = read("features/prospects/ui/components/XChatUnlockGate.tsx");
  const agentCard = read(
    "features/agent/ui/components/xchat-history/XChatUnlockCard.tsx"
  );

  assert.match(gate, /onComplete=\{onPinComplete\}/);
  assert.match(gate, /autoFocus/);
  assert.doesNotMatch(gate, /type="submit"/);
  assert.match(gate, /Enter your XChat PIN/);
  assert.doesNotMatch(gate, /font-pixel-square/);
  assert.match(gate, /text-xl/);
  assert.match(gate, /sm:text-2xl/);
  assert.doesNotMatch(gate, /It never leaves this browser/);
  assert.match(gate, /absolute inset-0 flex items-center justify-center/);
  assert.match(gate, /variant="circle"/);
  assert.doesNotMatch(gate, /Unlocking…/);
  assert.doesNotMatch(gate, /rounded-full/);
  assert.match(gate, /<XChatIcon className="mb-4 size-16" aria-hidden \/>/);
  assert.match(gate, /<XChatIcon[\s\S]*?<h2[\s\S]*?id="xchat-unlock-title"/);
  assert.doesNotMatch(gate, /flex items-center justify-center gap-2/);
  assert.match(unlock, /unlockInFlightRef/);
  assert.match(unlock, /handleUnlock\(completedPin\)/);
  assert.match(unlock, /getXChatUnlockErrorMessage\(error\)/);
  assert.doesNotMatch(unlock, /error instanceof Error \? error\.message/);
  assert.match(agentCard, /onComplete=\{\(completedPin\)/);
  assert.doesNotMatch(agentCard, /type="submit"/);
  assert.doesNotMatch(agentCard, /It never leaves this browser/);
});

test("DM sends reset immediately and move provider state into message rows", () => {
  const baseComposer = read("features/composer/ui/components/BaseComposer.tsx");
  const toolbar = read("features/composer/ui/components/ComposerToolbar.tsx");
  const enterPlugin = read(
    "features/composer/ui/components/SubmitOnEnterPlugin.tsx"
  );
  const linkedInHook = read(
    "features/prospects/hooks/useProspectLinkedInPanel.ts"
  );
  const linkedInPanel = read(
    "features/prospects/ui/components/LinkedInConversationPanel.tsx"
  );
  const xPanel = read(
    "features/prospects/ui/components/XConversationPanel.tsx"
  );

  assert.match(baseComposer, /submitMode === "optimistic"/);
  assert.match(
    baseComposer,
    /resetComposer\(false\);[\s\S]*?await onSubmit\?\.\(/
  );
  assert.match(baseComposer, /submitOnEnter=\{submitOnEnter\}/);
  assert.match(baseComposer, /onSubmitShortcut=\{handleSubmit\}/);
  assert.doesNotMatch(toolbar, /submitPendingLabel/);
  assert.doesNotMatch(toolbar, /<Spinner/);
  assert.match(enterPlugin, /event\.isComposing/);
  assert.match(enterPlugin, /event\.shiftKey/);
  assert.match(linkedInHook, /enqueueOutboundMessage/);
  assert.doesNotMatch(linkedInHook, /sendLinkedInMessage/);
  assert.match(linkedInPanel, /submitMode="?\{?isTaskApprovalComposer/);
  assert.match(xPanel, /submitMode="?\{?isTaskApprovalComposer/);
  assert.match(linkedInPanel, /catch \(err\)[\s\S]*?throw err;/);
  assert.match(xPanel, /catch \(err\)[\s\S]*?throw err;/);
});

test("DM media polish uses the house primitives", () => {
  const placeholder = read(
    "shared/ui/components/MediaUnavailablePlaceholder.tsx"
  );
  const voiceNote = read(
    "features/prospects/ui/components/conversation-message/ConversationVoiceNote.tsx"
  );
  const uploads = read(
    "features/composer/ui/components/MediaUploadSection.tsx"
  );

  assert.match(placeholder, /flex-col/);
  assert.match(
    placeholder,
    /style=\{aspectRatio \? \{ aspectRatio \} : undefined\}/
  );
  assert.match(placeholder, /rounded-md/);
  assert.doesNotMatch(placeholder, /description/);
  assert.doesNotMatch(placeholder, /shadow/);
  assert.doesNotMatch(placeholder, /absolute/);
  assert.doesNotMatch(placeholder, /text-(?:muted|foreground)/);
  assert.doesNotMatch(placeholder, /bg-muted/);
  assert.match(voiceNote, /<AnimatedNumber/);
  assert.match(uploads, /DescriptionIcon/);
  assert.doesNotMatch(uploads, /lucide-react/);
});

test("LinkedIn DMs expose the document types already supported by validation", () => {
  const baseComposer = read("features/composer/ui/components/BaseComposer.tsx");
  const toolbar = read("features/composer/ui/components/ComposerToolbar.tsx");

  assert.match(baseComposer, /fileAccept: LINKEDIN_MESSAGE_DOCUMENT_ACCEPT/);
  assert.match(baseComposer, /showFile: allowFileUpload/);
  assert.match(baseComposer, /Only one attachment is allowed\./);
  assert.doesNotMatch(baseComposer, /Maximum 4 attachments are allowed\./);
  assert.match(toolbar, /aria-label="Upload files"/);
  assert.match(toolbar, /aria-label="Add file"/);
});

test("LinkedIn attachment hydration keeps the sender-visible filename", () => {
  const attachments = read(
    "features/prospects/ui/components/conversation-message/ConversationRichAttachments.tsx"
  );

  assert.match(
    attachments,
    /fileName: attachment\.fileName \?\? resolved\.fileName/
  );
});

test("attachment downloads live in the message action pill, not fullscreen viewers", () => {
  const actions = read(
    "features/prospects/ui/components/conversation-message/ConversationMessageActions.tsx"
  );
  const message = read(
    "features/prospects/ui/components/conversation-message/ConversationMessageItem.tsx"
  );
  const fileAttachment = read(
    "features/prospects/ui/components/conversation-message/ConversationFileAttachment.tsx"
  );
  const xViewer = read("features/threads/ui/components/GalleryViewer.tsx");
  const linkedInViewer = read(
    "features/webapp/ui/components/linkedin/LinkedInGalleryViewer.tsx"
  );

  assert.match(actions, /DownloadIcon/);
  assert.match(actions, /downloadActions/);
  assert.match(actions, /aria-label={`Download \${singleDownload\.label}`}/);
  assert.match(message, /useConversationMessageDownloads/);
  assert.match(message, /downloadActions={downloadActions}/);
  assert.doesNotMatch(fileAttachment, /download=/);
  assert.doesNotMatch(xViewer, /DownloadIcon/);
  assert.doesNotMatch(linkedInViewer, /DownloadIcon/);
});

test("LinkedIn attachment failures keep the compact shell and expose retry", () => {
  const attachments = read(
    "features/prospects/ui/components/conversation-message/ConversationRichAttachments.tsx"
  );
  const unavailable = read(
    "features/prospects/ui/components/conversation-message/ConversationUnavailableAttachment.tsx"
  );
  const placeholder = read(
    "shared/ui/components/MediaUnavailablePlaceholder.tsx"
  );

  assert.match(attachments, /failed \? \([\s\S]*?onRetry=\{retry\}/);
  assert.match(
    attachments,
    /failed \? \([\s\S]{0,320}<ConversationUnavailableAttachment[\s\S]{0,320}\) : \([\s\S]{0,180}<ConversationAttachmentSkeleton/
  );
  assert.match(unavailable, /<MediaRetryButton/);
  assert.match(placeholder, /min-h-20/);
  assert.match(placeholder, /flex-col/);
  assert.match(unavailable, /getMediaAspectRatio/);
});

test("runtime image and video failures can recover without a page reload", () => {
  const linkedInMedia = read(
    "features/webapp/ui/components/linkedin/LinkedInMediaGrid.tsx"
  );
  const tweetMedia = read("features/threads/ui/components/TweetMedia.tsx");
  const retryHook = read("shared/ui/hooks/use-retryable-media-failures.ts");

  for (const media of [linkedInMedia, tweetMedia]) {
    assert.match(media, /useRetryableMediaFailures/);
    assert.match(media, /<MediaRetryButton/);
    assert.match(media, /retryingKeys|retryingMediaUrls/);
  }
  assert.match(retryHook, /await retryAction\?\.\(\)/);
  assert.match(retryHook, /next\.delete\(key\)/);
});

test("message actions anchor to the rendered surface and remain available on touch", () => {
  const actions = read(
    "features/prospects/ui/components/conversation-message/ConversationMessageActions.tsx"
  );
  const message = read(
    "features/prospects/ui/components/conversation-message/ConversationMessageItem.tsx"
  );
  const viewport = read(
    "features/prospects/ui/components/ConversationMessageViewport.tsx"
  );

  assert.match(message, /data-message-cluster/);
  assert.match(message, /const hasBubble = Boolean/);
  assert.match(message, /const messageActions = \(/);
  assert.match(message, /hasRichSurface \? "w-full" : "w-fit"/);
  assert.match(message, /max-w-\[min\(70%,36rem\)\]/);
  assert.match(message, /calc\(100%_-_5\.25rem\)/);
  assert.match(message, /calc\(100%_-_8rem\)/);
  assert.match(message, /<div className="relative w-fit max-w-full">/);
  assert.match(message, /!hasBubble \? messageActions : null/);
  assert.match(message, /right-full mr-1\.5/);
  assert.match(message, /left-full ml-1\.5/);
  assert.match(actions, /data-message-action-rail/);
  assert.match(actions, /data-message-touch-actions/);
  assert.match(actions, /@media\(pointer:coarse\)/);
  assert.match(actions, /REACTION_OPTIONS\[platform\]/);
  assert.doesNotMatch(actions, /shadow-/);
  assert.match(viewport, /overflow-x-clip/);
});

test("reply UI uses the minimal message surface and shared attachment family", () => {
  const reply = read(
    "features/prospects/ui/components/conversation-message/ConversationReplyPreview.tsx"
  );
  const message = read(
    "features/prospects/ui/components/conversation-message/ConversationMessageItem.tsx"
  );
  const actions = read(
    "features/prospects/ui/components/conversation-message/ConversationMessageActions.tsx"
  );
  const linkedInPanel = read(
    "features/prospects/ui/components/LinkedInConversationPanel.tsx"
  );
  const xPanel = read(
    "features/prospects/ui/components/XConversationPanel.tsx"
  );

  assert.match(reply, /<blockquote/);
  assert.match(reply, /<Attachment/);
  assert.match(reply, /<AttachmentMedia/);
  assert.match(reply, /<AttachmentContent/);
  assert.match(reply, /<AttachmentAction/);
  assert.match(reply, /getConversationAttachmentKind/);
  assert.match(reply, /previewUrl && kind === "image"/);
  assert.match(reply, /PlayCircleIcon/);
  assert.match(reply, /MicIcon/);
  assert.doesNotMatch(reply, /AudioFileIcon/);
  assert.match(reply, /FileVisualIcon/);
  assert.doesNotMatch(reply, /DescriptionIcon/);
  assert.doesNotMatch(reply, /bg-muted\/60/);
  assert.doesNotMatch(reply, /ConversationRichAttachments/);
  assert.match(message, /<ConversationReplyQuote/);
  assert.match(actions, /QuickPhrasesIcon/);
  assert.doesNotMatch(actions, /ReplyIcon/);
  assert.match(linkedInPanel, /<ConversationComposerReplyTarget/);
  assert.match(linkedInPanel, /enrichLinkedInReplyTargetFromAttachmentCache/);
  assert.match(linkedInPanel, /const replyTarget = replyingTo/);
  assert.match(linkedInPanel, /setReplyingTo\(null\);[\s\S]*?send\(/);
  assert.match(
    linkedInPanel,
    /setReplyingTo\(\(current\) => current \?\? replyTarget\)/
  );
  assert.match(xPanel, /<ConversationComposerReplyTarget/);
  assert.match(xPanel, /const replyTarget = replyingTo/);
  assert.doesNotMatch(xPanel, /selectedMedia \|\| replyingTo/);
});

test("XChat branding stays on X direct-message surfaces", () => {
  const iconSource = read("shared/ui/components/icons/index.tsx");
  const xPanel = read(
    "features/prospects/ui/components/XConversationPanel.tsx"
  );
  const linkedInPanel = read(
    "features/prospects/ui/components/LinkedInConversationPanel.tsx"
  );
  const unlockGate = read(
    "features/prospects/ui/components/XChatUnlockGate.tsx"
  );
  const inlineDm = read("features/agent/ui/components/InlineDmPreviewCard.tsx");
  const profileHeader = read(
    "features/prospects/ui/components/ProspectProfileHeader.tsx"
  );
  const cardMenu = read(
    "features/prospects/ui/components/prospect-card/ProspectCardMenu.tsx"
  );
  const twitterProfile = read(
    "features/profile/ui/components/TwitterProfilePanel.tsx"
  );
  const agentChat = read("features/agent/ui/AgentChat.tsx");

  assert.match(iconSource, /export const XChatIcon/);
  assert.match(iconSource, /stroke="currentColor"/);
  assert.match(iconSource, /strokeWidth="1\.35"/);
  assert.doesNotMatch(xPanel, /XChatIcon|badgeIcon/);
  assert.doesNotMatch(inlineDm, /XChatIcon|badgeIcon/);
  assert.match(unlockGate, /<XChatIcon/);
  for (const touchpoint of [
    profileHeader,
    cardMenu,
    twitterProfile,
    agentChat,
  ]) {
    assert.match(touchpoint, /<XChatIcon/);
  }
  assert.doesNotMatch(linkedInPanel, /XChatIcon/);
});

test("LinkedIn replies use the supported SDK contract and provider-id fallback", () => {
  const client = read("convex/lib/unipileClient.ts");
  const linkedIn = read("convex/linkedin.ts");

  assert.match(client, /messaging\.sendMessage/);
  assert.match(client, /extra_params:[\s\S]*?account_id: args\.accountId/);
  assert.match(client, /quote_id: quoteId/);
  assert.match(client, /failure\.classification !== "unprocessable"/);
  assert.match(linkedIn, /quoteProviderId: quotedMessage\?\.providerMessageId/);
});

test("DM media preserves intrinsic geometry and compact post behavior", () => {
  const attachments = read(
    "features/prospects/ui/components/conversation-message/ConversationRichAttachments.tsx"
  );
  const fileAttachment = read(
    "features/prospects/ui/components/conversation-message/ConversationFileAttachment.tsx"
  );
  const linkedInMedia = read(
    "features/webapp/ui/components/linkedin/LinkedInMediaGrid.tsx"
  );
  const tweetMedia = read("features/threads/ui/components/TweetMedia.tsx");
  const xPost = read(
    "features/prospects/ui/components/conversation-message/ConversationSharedPost.tsx"
  );
  const linkedInPost = read(
    "features/prospects/ui/components/conversation-message/ConversationLinkedInPost.tsx"
  );
  const openGraphPreview = read(
    "features/composer/ui/components/OpenGraphPreview.tsx"
  );

  assert.doesNotMatch(linkedInMedia, /aspectRatio: 16 \/ 9/);
  assert.match(linkedInMedia, /getMediaAspectRatio\(m\)/);
  assert.match(linkedInMedia, /layout === "conversation"/);
  assert.match(linkedInMedia, /naturalWidth \/ image\.naturalHeight/);
  assert.match(linkedInMedia, /className="object-contain"/);
  assert.match(attachments, /layout="conversation"/);
  assert.doesNotMatch(attachments, /AttachmentSendingIndicator/);
  assert.doesNotMatch(fileAttachment, /isSending|<Spinner|"Sending"/);
  assert.match(fileAttachment, /FileVisualIcon/);
  assert.doesNotMatch(fileAttachment, /DescriptionIcon/);
  assert.match(tweetMedia, /getMediaAspectRatio/);
  assert.match(tweetMedia, /aspectRatio=\{computeMediaAspect\(item\)\}/);
  assert.match(attachments, /ConversationLinkPreviewFallback/);
  assert.match(attachments, /isSameXPostReference/);
  assert.match(openGraphPreview, /return fallback/);
  assert.match(xPost, /bodyLineClamp=\{3\}/);
  assert.doesNotMatch(
    xPost,
    /showFullContent|showOpenGraphPreview=\{false\}|readOnly/
  );
  assert.doesNotMatch(linkedInPost, /showFullContent/);
  assert.match(linkedInPost, /<QuoteLinkedInCardSkeleton/);
  assert.doesNotMatch(linkedInPost, /h-28/);
});

test("mobile DM sub-panels do not remain behind the profile drawer", () => {
  const renderer = read(
    "features/prospects/ui/components/ProspectPanelRenderer.tsx"
  );

  assert.match(renderer, /renderPanelContent\(panelEntry, isActive\)/);
  assert.match(renderer, /disableMobileDrawer=\{!isActive\}/);
});

test("XChat access failures stay locked without becoming console errors", () => {
  const unlock = read(
    "features/prospects/ui/components/XChatConversationUnlock.tsx"
  );
  const gate = read("features/prospects/ui/components/XChatUnlockGate.tsx");
  const session = read("features/agent/lib/xChatBrowserSession.ts");

  assert.match(unlock, /response\.availability === "blocked"/);
  assert.match(unlock, /status: "configuration_required"/);
  assert.match(gate, /XChat API access unavailable/);
  assert.match(gate, /\/settings\/connected-accounts/);
  assert.match(session, /reason: "xchat_access_denied"/);
});
