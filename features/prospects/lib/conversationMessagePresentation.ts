import {
  formatDateOnlyValue,
  getCurrentUTCTimestamp,
} from "../../../shared/lib/utils";
import type { RichConversationMessage } from "../ui/components/conversation-message/types";
import {
  buildTwitterPostUrl,
  extractTwitterPostIdFromUrl,
} from "../../../shared/lib/twitter/contracts";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const HTTP_URL_PATTERN = /https?:\/\/[^\s<>]+/i;
const TRAILING_URL_PUNCTUATION_PATTERN = /[),.!?;:'"]+$/;
const REACTION_EVENT_TYPE = "message_reaction";
const REACTION_EVENT_LABEL_PATTERN = /\breacted\b/iu;

export function shouldRenderConversationMessage(
  message: RichConversationMessage
): boolean {
  const hasReactionEventType = [
    message.sourceEventType,
    message.eventMetadata?.providerEventType,
  ]
    .filter((eventType): eventType is string => Boolean(eventType))
    .some((eventType) => eventType.toLowerCase() === REACTION_EVENT_TYPE);
  const eventLabel = message.eventMetadata?.eventLabel || message.text;
  const hasReactionEventLabel =
    message.isEvent === true && REACTION_EVENT_LABEL_PATTERN.test(eventLabel);

  return !hasReactionEventType && !hasReactionEventLabel;
}

function toTimestamp(value?: string): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isSameCalendarDay(leftTimestamp: number, rightTimestamp: number) {
  return (
    formatDateOnlyValue(leftTimestamp) === formatDateOnlyValue(rightTimestamp)
  );
}

function canGroup(
  left: RichConversationMessage | undefined,
  right: RichConversationMessage | undefined
): boolean {
  if (!left || !right || left.isEvent || right.isEvent) return false;
  if (left.deliveryStatus || right.deliveryStatus) return false;
  if (left.direction !== right.direction) return false;

  const leftTimestamp = toTimestamp(left.createdAt);
  const rightTimestamp = toTimestamp(right.createdAt);
  if (leftTimestamp === null || rightTimestamp === null) return false;

  return (
    isSameCalendarDay(leftTimestamp, rightTimestamp) &&
    Math.abs(rightTimestamp - leftTimestamp) <= GROUP_WINDOW_MS
  );
}

export function getConversationMessageGrouping(
  messages: RichConversationMessage[],
  index: number
): "first" | "middle" | "last" | "none" {
  const previousMatches = canGroup(messages[index - 1], messages[index]);
  const nextMatches = canGroup(messages[index], messages[index + 1]);

  if (!previousMatches && !nextMatches) return "none";
  if (!previousMatches) return "first";
  if (!nextMatches) return "last";
  return "middle";
}

export function shouldShowConversationDaySeparator(
  messages: RichConversationMessage[],
  index: number
): boolean {
  const currentTimestamp = toTimestamp(messages[index]?.createdAt);
  if (currentTimestamp === null) return false;

  const previousTimestamp = toTimestamp(messages[index - 1]?.createdAt);
  return (
    previousTimestamp === null ||
    !isSameCalendarDay(previousTimestamp, currentTimestamp)
  );
}

export function formatConversationDayLabel(
  createdAt?: string,
  now = getCurrentUTCTimestamp()
): string {
  const timestamp = toTimestamp(createdAt);
  if (timestamp === null) return "";
  if (isSameCalendarDay(timestamp, now)) return "Today";
  if (isSameCalendarDay(timestamp, now - 24 * 60 * 60 * 1000)) {
    return "Yesterday";
  }

  const date = new Date(timestamp);
  const nowDate = new Date(now);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === nowDate.getFullYear()
      ? {}
      : { year: "numeric" as const }),
  }).format(date);
}

export function formatConversationMessageTime(createdAt?: string): string {
  const timestamp = toTimestamp(createdAt);
  if (timestamp === null) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function getFirstHttpUrl(text?: string): string | undefined {
  const match = text?.match(HTTP_URL_PATTERN)?.[0];
  return match?.replace(TRAILING_URL_PUNCTUATION_PATTERN, "");
}

export function getSharedXPostFromText(
  text?: string
): { id: string; url: string } | undefined {
  const firstUrl = getFirstHttpUrl(text);
  if (!firstUrl) return undefined;
  const id = extractTwitterPostIdFromUrl(firstUrl);
  return id ? { id, url: buildTwitterPostUrl({ postId: id }) } : undefined;
}

export function isSameXPostReference(
  candidateUrl: string | undefined,
  post: { id?: string; url: string } | undefined
): boolean {
  if (!candidateUrl || !post) return false;
  if (candidateUrl === post.url) return true;

  const candidatePostId = extractTwitterPostIdFromUrl(candidateUrl);
  const postId = extractTwitterPostIdFromUrl(post.url) ?? post.id;
  return Boolean(candidatePostId && postId && candidatePostId === postId);
}

export function getConversationMessageDisplayText(
  text: string,
  options?: { hideFirstUrl?: boolean }
): string {
  if (!options?.hideFirstUrl) return text;
  const firstUrl = getFirstHttpUrl(text);
  if (!firstUrl) return text;
  return text
    .replace(firstUrl, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function hasConversationMessageRichSurface(
  message: RichConversationMessage,
  platform: "linkedin" | "twitter"
): boolean {
  return Boolean(
    message.quotedMessage ||
    message.sharedPost ||
    message.attachments?.length ||
    getFirstHttpUrl(message.text) ||
    (platform === "twitter" && getSharedXPostFromText(message.text))
  );
}

export function formatConversationFileSize(bytes?: number): string | undefined {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
    return undefined;
  }
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}
