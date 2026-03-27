"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";

type BubbleGrouping = "first" | "middle" | "last" | "none";

const groupedRadius: Record<BubbleGrouping, string> = {
  none: "rounded-[20px]",
  first: "rounded-[20px] rounded-bl-md",
  middle: "rounded-[20px]",
  last: "rounded-[20px] rounded-tl-md",
};

const groupedRadiusSent: Record<BubbleGrouping, string> = {
  none: "rounded-[20px]",
  first: "rounded-[20px] rounded-br-md",
  middle: "rounded-[20px]",
  last: "rounded-[20px] rounded-tr-md",
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

  return (
    <div
      className={cn(
        "max-w-[78%] px-4 py-2 text-[15px] leading-6 shadow-sm",
        isSent
          ? cn(
              "bg-foreground text-background self-end",
              groupedRadiusSent[grouped]
            )
          : cn(
              "bg-muted/60 text-foreground self-start",
              groupedRadius[grouped]
            ),
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
