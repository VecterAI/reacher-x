export type StyleSyncIssuePlatform = "twitter" | "linkedin";

export function getStyleSyncIssueTitle(platform: StyleSyncIssuePlatform) {
  return platform === "linkedin"
    ? "Couldn't sync your LinkedIn writing style"
    : "Couldn't sync your X/Twitter writing style";
}

export function getStyleSyncIssueDescription(platform: StyleSyncIssuePlatform) {
  return platform === "linkedin"
    ? "Your account is still connected. We'll keep using your existing LinkedIn writing style for now. If this keeps happening, reconnect LinkedIn from Connected Accounts."
    : "Your account is still connected. We'll keep using your existing X/Twitter writing style for now. If this keeps happening, reconnect X/Twitter from Connected Accounts.";
}

export function getStyleSyncIssueInlineMessage(
  platform: StyleSyncIssuePlatform
) {
  return platform === "linkedin"
    ? "Style sync hit a recoverable LinkedIn issue. Your account is still connected, and we'll keep using your existing LinkedIn writing style for now."
    : "Style sync hit a recoverable X/Twitter issue. Your account is still connected, and we'll keep using your existing X/Twitter writing style for now.";
}
