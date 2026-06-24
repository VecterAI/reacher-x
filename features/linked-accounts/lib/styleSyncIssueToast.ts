"use client";

import { toast } from "sonner";
import {
  getStyleSyncIssueDescription,
  getStyleSyncIssueTitle,
  type StyleSyncIssuePlatform,
} from "./styleSyncIssueCopy";

const STYLE_SYNC_ISSUE_STORAGE_KEY = "linked-accounts:style-sync-issues";

type StyleSyncIssueToast = {
  key: string;
  lastError?: string;
};

function getSeenIssueKeys(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(STYLE_SYNC_ISSUE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function rememberSeenIssueKey(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const nextKeys = [...new Set([...getSeenIssueKeys(), key])];
    window.sessionStorage.setItem(
      STYLE_SYNC_ISSUE_STORAGE_KEY,
      JSON.stringify(nextKeys)
    );
  } catch {
    // Ignore sessionStorage failures and fall back to in-memory dedupe in the hook.
  }
}

function hasSeenIssueKey(key: string) {
  return getSeenIssueKeys().includes(key);
}

export function showStyleSyncIssueToast(args: {
  issue: StyleSyncIssueToast;
  platform: StyleSyncIssuePlatform;
}) {
  if (!args.issue.key || hasSeenIssueKey(args.issue.key)) {
    return;
  }

  rememberSeenIssueKey(args.issue.key);
  toast.error(getStyleSyncIssueTitle(args.platform), {
    description: getStyleSyncIssueDescription(args.platform),
  });
}
