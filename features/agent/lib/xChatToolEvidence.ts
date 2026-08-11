export type LockedXChatToolEvidence = {
  prospectName: string;
  eventCount: number;
  inboundEventCount: number;
  outboundEventCount: number;
  hasMore: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function getLockedXChatToolEvidence(
  result: unknown
): LockedXChatToolEvidence | null {
  const history = asRecord(asRecord(result)?.history);
  const prospect = asRecord(history?.prospect);
  const evidence = Array.isArray(history?.evidence) ? history.evidence : [];
  const twitterEvidence = evidence
    .map(asRecord)
    .find((item) => item?.platform === "twitter");
  const xChat = asRecord(twitterEvidence?.xChat);
  if (
    xChat?.conversationFound !== true ||
    xChat.contentState !== "encrypted_locked"
  ) {
    return null;
  }

  return {
    prospectName:
      typeof prospect?.name === "string" && prospect.name.trim()
        ? prospect.name.trim()
        : "this prospect",
    eventCount: typeof xChat.eventCount === "number" ? xChat.eventCount : 0,
    inboundEventCount:
      typeof xChat.inboundEventCount === "number" ? xChat.inboundEventCount : 0,
    outboundEventCount:
      typeof xChat.outboundEventCount === "number"
        ? xChat.outboundEventCount
        : 0,
    hasMore: xChat.hasMore === true,
  };
}
