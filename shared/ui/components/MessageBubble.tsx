"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";

type BubbleGrouping = "first" | "middle" | "last" | "none";

const groupedRadiusReceived: Record<BubbleGrouping, string> = {
  none: "rounded-[20px]",
  first: "rounded-[20px]",
  middle: "rounded-[20px]",
  last: "rounded-[20px]",
};

const groupedRadiusSent: Record<BubbleGrouping, string> = {
  none: "rounded-[20px]",
  first: "rounded-[20px]",
  middle: "rounded-[20px]",
  last: "rounded-[20px]",
};

export interface MessageBubbleProps {
  message?: string;
  variant?: "sent" | "received";
  grouped?: BubbleGrouping;
  className?: string;
  children?: React.ReactNode;
}

export function MessageBubble({
  message,
  variant = "received",
  grouped = "none",
  className,
  children,
}: MessageBubbleProps) {
  const isSent = variant === "sent";
  const showTail = grouped === "none" || grouped === "last";
  const tailBaseClassName =
    "before:absolute before:bottom-0 before:h-[18px] before:content-[''] after:absolute after:bottom-0 after:h-[18px] after:bg-background after:content-['']";
  const tailClassName = isSent
    ? "before:-right-[7px] before:w-5 before:rounded-bl-[16px_14px] after:-right-[26px] after:w-[26px] after:rounded-bl-[10px]"
    : "before:-left-[7px] before:w-5 before:rounded-br-2xl after:-left-[26px] after:w-[26px] after:rounded-br-[10px]";

  return (
    <div
      className={cn(
        "relative max-w-[78%] px-5 py-2 text-[15px] leading-6",
        isSent
          ? cn(
              "bg-foreground text-background self-end",
              groupedRadiusSent[grouped]
            )
          : cn(
              "bg-muted text-foreground self-start",
              groupedRadiusReceived[grouped]
            ),
        showTail ? tailBaseClassName : null,
        showTail ? tailClassName : null,
        showTail ? (isSent ? "before:bg-foreground" : "before:bg-muted") : null,
        className
      )}
    >
      {children ?? message}
    </div>
  );
}

export interface ChatMessageProps {
  messages: string[];
  variant?: "sent" | "received";
  timestamp?: string;
  showTimestamp?: boolean;
  className?: string;
}

export function ChatMessage({
  messages,
  variant = "received",
  timestamp,
  showTimestamp = true,
  className,
}: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        variant === "sent" ? "items-end" : "items-start",
        className
      )}
    >
      {messages.map((message, index) => {
        const grouped: BubbleGrouping =
          messages.length === 1
            ? "none"
            : index === 0
              ? "first"
              : index === messages.length - 1
                ? "last"
                : "middle";
        return (
          <MessageBubble
            key={`${variant}-${index}-${message}`}
            message={message}
            variant={variant}
            grouped={grouped}
          />
        );
      })}
      {showTimestamp && timestamp ? (
        <div className="text-muted-foreground px-1 text-xs">{timestamp}</div>
      ) : null}
    </div>
  );
}
