"use client";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/DropdownMenu";
import {
  DownloadIcon,
  MoodIcon,
  MoreHorizIcon,
  QuickPhrasesIcon,
} from "@/shared/ui/components/icons/index";
import type {
  ConversationMessagePlatform,
  ConversationReaction,
} from "./types";
import { LINKEDIN_MESSAGE_REACTIONS } from "@/shared/lib/linkedin/messageReaction";

const REACTION_OPTIONS: Record<ConversationMessagePlatform, string[]> = {
  linkedin: [...LINKEDIN_MESSAGE_REACTIONS],
  twitter: ["❤️", "👍", "😂", "🎉", "👏", "👀", "💡", "🖤"],
};

interface DownloadAction {
  id: string;
  isLoading: boolean;
  label: string;
  onDownload: () => void;
}

interface ConversationMessageActionsProps {
  platform: ConversationMessagePlatform;
  reactions?: ConversationReaction[];
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  isReacting?: boolean;
  downloadActions?: DownloadAction[];
  className?: string;
}

function ReactionOptions({
  platform,
  reactions,
  onReact,
  isReacting = false,
}: {
  platform: ConversationMessagePlatform;
  reactions?: ConversationReaction[];
  onReact: (emoji: string) => void;
  isReacting?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-0.5",
        platform === "linkedin" ? "grid-cols-6" : "grid-cols-4"
      )}
      aria-label="Reactions"
    >
      {REACTION_OPTIONS[platform].map((emoji) => {
        const selected = reactions?.some(
          (reaction) => reaction.emoji === emoji && reaction.reactedByViewer
        );
        const cannotRemove = platform === "linkedin" && selected;
        return (
          <DropdownMenuItem
            key={emoji}
            className={cn(
              "flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-lg",
              selected && "bg-accent ring-border ring-1"
            )}
            disabled={isReacting || cannotRemove}
            onSelect={() => onReact(emoji)}
            aria-label={
              cannotRemove
                ? `Already reacted with ${emoji}`
                : `${selected ? "Remove" : "React with"} ${emoji}`
            }
          >
            {emoji}
          </DropdownMenuItem>
        );
      })}
    </div>
  );
}

function DownloadMenuItems({ actions }: { actions: DownloadAction[] }) {
  return actions.map((action) => (
    <DropdownMenuItem
      key={action.id}
      disabled={action.isLoading}
      onSelect={action.onDownload}
      aria-label={`Download ${action.label}`}
    >
      <DownloadIcon aria-hidden="true" />
      <span className="truncate">{action.label}</span>
    </DropdownMenuItem>
  ));
}

export function ConversationMessageActions({
  platform,
  reactions,
  onReply,
  onReact,
  isReacting = false,
  downloadActions = [],
  className,
}: ConversationMessageActionsProps) {
  if (!onReply && !onReact && !downloadActions.length) return null;

  const singleDownload =
    downloadActions.length === 1 ? downloadActions[0] : undefined;

  return (
    <div className={cn("z-10 shrink-0", className)}>
      <div
        data-message-action-rail
        className="bg-background/96 border-border pointer-events-none flex items-center rounded-full border p-0.5 opacity-0 transition-[opacity,transform] duration-150 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100 group-hover/message:pointer-events-auto group-hover/message:opacity-100 has-[[data-state=open]]:pointer-events-auto has-[[data-state=open]]:opacity-100 [@media(pointer:coarse)]:hidden"
      >
        {onReply ? (
          <Button
            type="button"
            variant="ghost"
            size="xsIcon"
            className="rounded-full"
            onClick={onReply}
            aria-label="Reply to message"
          >
            <QuickPhrasesIcon
              className="size-3.5 fill-current"
              aria-hidden="true"
            />
          </Button>
        ) : null}
        {onReact ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xsIcon"
                className="rounded-full"
                aria-label="Add reaction"
                aria-busy={isReacting}
                disabled={isReacting}
              >
                <MoodIcon
                  className="size-3.5 fill-current"
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-0 p-1.5">
              <ReactionOptions
                platform={platform}
                reactions={reactions}
                onReact={onReact}
                isReacting={isReacting}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {singleDownload ? (
          <Button
            type="button"
            variant="ghost"
            size="xsIcon"
            className="rounded-full"
            onClick={singleDownload.onDownload}
            disabled={singleDownload.isLoading}
            aria-busy={singleDownload.isLoading}
            aria-label={`Download ${singleDownload.label}`}
          >
            <DownloadIcon className="size-3.5" aria-hidden="true" />
          </Button>
        ) : downloadActions.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xsIcon"
                className="rounded-full"
                aria-label="Download attachment"
              >
                <DownloadIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="max-w-64 min-w-44">
              <DownloadMenuItems actions={downloadActions} />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="xsIcon"
            data-message-touch-actions
            className="bg-background/96 hidden rounded-full [@media(pointer:coarse)]:inline-flex"
            aria-label="Message actions"
          >
            <MoreHorizIcon
              className="size-3.5 fill-current"
              aria-hidden="true"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="max-w-64 min-w-44">
          {onReply ? (
            <DropdownMenuItem onSelect={onReply}>
              <QuickPhrasesIcon className="fill-current" aria-hidden="true" />
              Reply
            </DropdownMenuItem>
          ) : null}
          {onReact ? (
            <>
              {onReply ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
                React
              </DropdownMenuLabel>
              <ReactionOptions
                platform={platform}
                reactions={reactions}
                onReact={onReact}
                isReacting={isReacting}
              />
            </>
          ) : null}
          {downloadActions.length ? (
            <>
              {onReply || onReact ? <DropdownMenuSeparator /> : null}
              <DownloadMenuItems actions={downloadActions} />
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
