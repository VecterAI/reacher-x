"use client";

import * as React from "react";
import type { TwitterViewerState } from "@/shared/lib/twitter/contracts";

export type TwitterPostEngagementState = {
  viewerStatePatch?: Partial<
    Pick<TwitterViewerState, "liked" | "retweeted" | "commented">
  >;
  likeCount?: number;
  repeatCount?: number;
};

const listeners = new Set<() => void>();
const engagementStateByPostId = new Map<string, TwitterPostEngagementState>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function normalizePostId(postId?: string | number | null) {
  if (postId == null) {
    return undefined;
  }
  const normalized = String(postId).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeCount(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : undefined;
}

function hasViewerStatePatch(
  patch?: TwitterPostEngagementState["viewerStatePatch"]
) {
  return (
    patch?.liked !== undefined ||
    patch?.retweeted !== undefined ||
    patch?.commented !== undefined
  );
}

function areStatesEqual(
  a?: TwitterPostEngagementState,
  b?: TwitterPostEngagementState
) {
  return (
    a?.viewerStatePatch?.liked === b?.viewerStatePatch?.liked &&
    a?.viewerStatePatch?.retweeted === b?.viewerStatePatch?.retweeted &&
    a?.viewerStatePatch?.commented === b?.viewerStatePatch?.commented &&
    a?.likeCount === b?.likeCount &&
    a?.repeatCount === b?.repeatCount
  );
}

export function useTwitterPostEngagementState(
  postId?: string | number | null
) {
  const normalizedPostId = normalizePostId(postId);

  return React.useSyncExternalStore(
    subscribe,
    () =>
      normalizedPostId
        ? engagementStateByPostId.get(normalizedPostId)
        : undefined,
    () => undefined
  );
}

export function cacheTwitterPostEngagement(args: {
  postId?: string | number | null;
  viewerStatePatch?: TwitterPostEngagementState["viewerStatePatch"];
  likeCount?: number | null;
  repeatCount?: number | null;
}) {
  const postId = normalizePostId(args.postId);
  if (!postId) {
    return;
  }

  const existing = engagementStateByPostId.get(postId);
  const viewerStatePatch = {
    ...existing?.viewerStatePatch,
    ...args.viewerStatePatch,
  };
  const nextState: TwitterPostEngagementState = {
    viewerStatePatch: hasViewerStatePatch(viewerStatePatch)
      ? viewerStatePatch
      : undefined,
    likeCount:
      normalizeCount(args.likeCount) ??
      (typeof existing?.likeCount === "number" ? existing.likeCount : undefined),
    repeatCount:
      normalizeCount(args.repeatCount) ??
      (typeof existing?.repeatCount === "number"
        ? existing.repeatCount
        : undefined),
  };

  if (!hasViewerStatePatch(nextState.viewerStatePatch)) {
    delete nextState.viewerStatePatch;
  }
  if (nextState.likeCount === undefined) {
    delete nextState.likeCount;
  }
  if (nextState.repeatCount === undefined) {
    delete nextState.repeatCount;
  }

  if (areStatesEqual(existing, nextState)) {
    return;
  }

  engagementStateByPostId.set(postId, nextState);
  emitChange();
}
