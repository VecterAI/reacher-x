/**
 * ThreadCard
 * Displays a thread in the history panel with title, timestamp, and delete action.
 */
"use client";

import * as React from "react";
import { formatRelativeTime } from "@/shared/lib/utils";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { Badge } from "@/shared/ui/components/Badge";
import { DeleteIcon, QuickPhrasesIcon } from "@/shared/ui/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/components/AlertDialog";

export interface ThreadData {
  _id: string;
  title?: string;
  _creationTime: number;
  status?: "active" | "archived";
}

export interface ThreadCardProps {
  thread: ThreadData;
  isActive?: boolean;
  /** First user message content to display as title */
  firstMessage?: string;
  /** Pre-highlighted match preview from vector search - shown as title when searching */
  matchPreview?: React.ReactNode;
  onSelect: () => void;
  onDelete: () => void;
  className?: string;
}

export function ThreadCard({
  thread,
  isActive = false,
  firstMessage,
  matchPreview,
  onSelect,
  onDelete,
  className,
}: ThreadCardProps) {
  // Display title priority:
  // 1. matchPreview (when searching) - already highlighted by parent
  // 2. firstMessage (first user message content)
  // 3. Default fallback
  const displayTitle = matchPreview ?? firstMessage ?? "New conversation";

  const timeAgo = formatRelativeTime(
    new Date(thread._creationTime).toISOString()
  );

  return (
    <article
      className={cn(
        "group border-border flex cursor-pointer items-start gap-2 border-b p-4",

        className
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <span
        className={cn(
          "bg-secondary shrink-0 rounded-md p-1",
          isActive && "bg-foreground"
        )}
      >
        <QuickPhrasesIcon
          className={cn("fill-current", isActive && "text-background")}
        />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-foreground line-clamp-2 text-sm">{displayTitle}</p>
        <div className="mt-1 flex items-center gap-2">
          <time
            dateTime={new Date(thread._creationTime).toISOString()}
            className="text-muted-foreground text-sm"
          >
            {timeAgo}
          </time>
          {isActive && <Badge variant="outline">Current</Badge>}
        </div>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="xsIcon"
            onClick={(e) => e.stopPropagation()}
          >
            <DeleteIcon className="fill-current" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete thread?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="xs" onClick={(e) => e.stopPropagation()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
