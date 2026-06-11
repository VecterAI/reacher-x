"use client";

import * as React from "react";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { resolveLinkedInPostReference } from "@/shared/lib/linkedin/comments";

type LinkedInPostReactionState = {
  viewerReaction?: string;
  reactionCount?: number;
};

const listeners = new Set<() => void>();
const reactionStateByKey = new Map<string, LinkedInPostReactionState>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dedupeKeys(keys: Array<string | undefined>) {
  return Array.from(
    new Set(
      keys.filter(
        (key): key is string => typeof key === "string" && key.trim().length > 0
      )
    )
  );
}

function normalizeViewerReaction(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : undefined;
}

function normalizeReactionCount(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : undefined;
}

export function getLinkedInPostReactionKeys(
  post: UnifiedPost | null | undefined
) {
  if (!post) {
    return [];
  }

  const resolved = resolveLinkedInPostReference({ post, postData: post });
  return dedupeKeys([
    post.id,
    resolved.resolvedPostId,
    resolved.socialId,
    resolved.readUrn,
  ]);
}

function getSnapshotForKeys(keys: string[]) {
  for (const key of keys) {
    const state = reactionStateByKey.get(key);
    if (state) {
      return state;
    }
  }
  return undefined;
}

export function useLinkedInPostReactionState(
  post: UnifiedPost | null | undefined
) {
  const keySignature = getLinkedInPostReactionKeys(post).join("::");

  return React.useSyncExternalStore(
    subscribe,
    () => getSnapshotForKeys(keySignature ? keySignature.split("::") : []),
    () => undefined
  );
}

export function cacheLinkedInPostReactionKeys(args: {
  keys: Array<string | undefined>;
  viewerReaction?: string | null;
  reactionCount?: number | null;
}) {
  const keys = dedupeKeys(args.keys);
  if (keys.length === 0) {
    return;
  }

  const viewerReaction = normalizeViewerReaction(args.viewerReaction);
  const reactionCount = normalizeReactionCount(args.reactionCount);

  let changed = false;
  for (const key of keys) {
    const existing = reactionStateByKey.get(key);
    if (viewerReaction || reactionCount !== undefined) {
      const nextState = {
        viewerReaction,
        reactionCount:
          reactionCount !== undefined
            ? reactionCount
            : existing?.reactionCount,
      };
      if (
        existing?.viewerReaction === nextState.viewerReaction &&
        existing?.reactionCount === nextState.reactionCount
      ) {
        continue;
      }
      reactionStateByKey.set(key, nextState);
      changed = true;
      continue;
    }

    if (!existing) {
      continue;
    }

    reactionStateByKey.delete(key);
    changed = true;
  }

  if (changed) {
    emitChange();
  }
}

export function cacheLinkedInPostReaction(args: {
  post: UnifiedPost | null | undefined;
  viewerReaction?: string | null;
  reactionCount?: number | null;
  resolvedPostId?: string;
  resolvedSocialId?: string;
}) {
  if (!args.post) {
    return;
  }

  cacheLinkedInPostReactionKeys({
    keys: [
      ...getLinkedInPostReactionKeys(args.post),
      args.resolvedPostId,
      args.resolvedSocialId,
    ],
    viewerReaction: args.viewerReaction,
    reactionCount: args.reactionCount,
  });
}
