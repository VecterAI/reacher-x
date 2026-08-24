"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";

export function useTwitterConversationTyping(args: {
  prospectId: string;
  enabled: boolean;
}) {
  const presence = useQuery(
    api.conversationTypingPresence.getTwitterForProspect,
    args.enabled ? { prospectId: args.prospectId as Id<"prospects"> } : "skip"
  );
  const [isTyping, setIsTyping] = React.useState(false);
  const expiresAt = presence?.expiresAt ?? 0;

  React.useEffect(() => {
    if (!args.enabled) {
      setIsTyping(false);
      return;
    }

    if (expiresAt <= 0) {
      setIsTyping(false);
      return;
    }

    const remainingMs = expiresAt - getCurrentUTCTimestamp();
    if (remainingMs <= 0) {
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    const timeout = window.setTimeout(() => {
      setIsTyping(false);
    }, remainingMs);
    return () => window.clearTimeout(timeout);
  }, [args.enabled, expiresAt]);

  return isTyping;
}
