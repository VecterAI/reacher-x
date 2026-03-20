/**
 * ReplyPanelContext
 * Optional context for opening the reply panel (post + composer).
 * When provided (e.g. in prospect layout), replaces current panel.
 * When not provided, consumers fall back to router navigation.
 */
"use client";

import * as React from "react";
import type { Tweet } from "@/features/threads/types";

export interface OpenReplyPanelParams {
  tweetId: string;
  threadId: string;
  initialTweet?: Tweet | null;
}

export type OpenReplyPanelFn = (params: OpenReplyPanelParams) => void;

const ReplyPanelContext = React.createContext<OpenReplyPanelFn | null>(null);

export function useReplyPanel(): OpenReplyPanelFn | null {
  return React.useContext(ReplyPanelContext);
}

export const ReplyPanelProvider = ReplyPanelContext.Provider;
