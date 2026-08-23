import { cn } from "@/shared/lib/utils";
import type { ConversationReaction } from "./types";

interface ConversationReactionsProps {
  reactions?: ConversationReaction[];
  platform: "linkedin" | "twitter";
  direction: "sent" | "received";
  onReactionClick?: (emoji: string) => void;
  isReacting?: boolean;
}

export function ConversationReactions({
  reactions,
  platform,
  direction,
  onReactionClick,
  isReacting = false,
}: ConversationReactionsProps) {
  if (!reactions?.length) return null;

  return (
    <div
      className={cn(
        "flex max-w-full flex-wrap gap-1",
        direction === "sent" ? "self-end" : "self-start"
      )}
      aria-label="Message reactions"
      aria-busy={isReacting}
    >
      {reactions.map((reaction) => {
        const content = (
          <>
            <span aria-hidden="true">{reaction.emoji}</span>
            {reaction.count > 1 ? (
              <span className="tabular-nums">{reaction.count}</span>
            ) : null}
          </>
        );
        const className = cn(
          "border-border bg-background inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs shadow-xs",
          reaction.reactedByViewer && "border-foreground/35 bg-muted"
        );

        const canSelect =
          Boolean(onReactionClick) &&
          !isReacting &&
          (platform !== "linkedin" || !reaction.reactedByViewer);
        return canSelect ? (
          <button
            type="button"
            key={reaction.emoji}
            className={className}
            onClick={() => onReactionClick?.(reaction.emoji)}
            aria-label={`${reaction.emoji} reaction, ${reaction.count}`}
          >
            {content}
          </button>
        ) : (
          <span
            key={reaction.emoji}
            className={className}
            aria-label={`${reaction.emoji} reaction, ${reaction.count}`}
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}
