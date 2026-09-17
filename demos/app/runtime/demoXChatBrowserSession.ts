/** Demo-only browser adapter. Never aliased by the customer application. */
export * from "../../../features/agent/lib/xChatBrowserSession";
import * as real from "../../../features/agent/lib/xChatBrowserSession";

export async function decryptXChatInBrowser(
  args: Parameters<typeof real.decryptXChatInBrowser>[0]
) {
  if (args.isCurrent?.() === false)
    throw new Error("X/Twitter Chat target changed.");
  if (!/^\d{4}$/.test(args.pin))
    throw new Error("Enter a four-digit demo PIN.");
  const messages = args.bundle.events.map((event) => ({
    id: event.id!,
    sequenceId: event.id,
    senderId: event.senderId!,
    direction:
      event.senderId === args.bundle.viewerUserId
        ? ("sent" as const)
        : ("received" as const),
    occurredAt: event.createdAtMs!,
    text: event.encodedEvent,
  }));
  real.cacheVerifiedXChatBrowserSession({
    ...args,
    messages,
    decryptionErrorCount: 0,
  });
  return { messages, decryptionErrorCount: 0 };
}
// Demo PINs are never stored or sent to X. Any four digits unlock fictional data.
export async function decryptXChatWithRememberedPin() {
  return { status: "missing" as const };
}
export async function rememberSuccessfulXChatPin() {}
export function hasUnlockedXChatSession(bundle: real.XChatDecryptBundle) {
  return Boolean(
    real.getXChatBrowserSession({
      viewerUserId: bundle.viewerUserId,
      participantUserId: bundle.participantUserId,
    })
  );
}
function prepare(args: {
  prospectId: string;
  text: string;
  clientRequestId?: string;
  mediaHashKey?: string;
}) {
  const session = real.getXChatBrowserSession({ prospectId: args.prospectId });
  if (!session) throw new Error("Unlock this conversation first.");
  const id = crypto.randomUUID();
  return {
    conversationId: session.conversationId,
    messageId: `demo-xchat-${id}`,
    clientRequestId: args.clientRequestId ?? id,
    encodedMessageCreateEvent: JSON.stringify({
      text: args.text,
      mediaHashKey: args.mediaHashKey,
    }),
    encodedMessageEventSignature: "fictional-demo-only",
  };
}
export async function preparePersistedXChatTextMessageInBrowser(
  args: Parameters<typeof real.preparePersistedXChatTextMessageInBrowser>[0]
) {
  return prepare(args);
}
export async function preparePersistedXChatReplyMessageInBrowser(
  args: Parameters<typeof real.preparePersistedXChatReplyMessageInBrowser>[0]
) {
  return prepare(args);
}
export function prepareXChatMediaMessageInBrowser(
  args: Parameters<typeof real.prepareXChatMediaMessageInBrowser>[0]
) {
  return prepare(args);
}
export function prepareXChatReactionInBrowser(
  args: Parameters<typeof real.prepareXChatReactionInBrowser>[0]
) {
  return prepare({ ...args, text: "" });
}
export async function prepareXChatEncryptedMediaInBrowser(
  args: Parameters<typeof real.prepareXChatEncryptedMediaInBrowser>[0]
): Promise<real.PreparedXChatEncryptedMedia> {
  const session = real.getXChatBrowserSession({ prospectId: args.prospectId });
  if (!session) throw new Error("Unlock this conversation first.");
  return {
    conversationId: session.conversationId,
    keyVersion: "demo",
    ciphertext: new Uint8Array(await args.file.arrayBuffer()),
    fileName: args.file.name,
    fileSize: args.file.size,
    mediaType: real.getXChatAttachmentMediaType(args.file.type),
    width: 0,
    height: 0,
    durationMs: args.durationMs,
  };
}
export async function appendXChatEventPageInBrowser(
  args: Parameters<typeof real.appendXChatEventPageInBrowser>[0]
) {
  const session = real.getXChatBrowserSession({ prospectId: args.prospectId });
  if (!session) throw new Error("Unlock this conversation first.");
  return;
}
