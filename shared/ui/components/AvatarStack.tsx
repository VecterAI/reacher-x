/**
 * AvatarStack
 * Displays stacked avatars of conversation participants.
 * Shows up to maxVisible avatars with a +N overflow indicator.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./Avatar";

export interface AvatarStackParticipant {
  avatarUrl?: string;
  name: string;
}

export interface AvatarStackProps {
  /** List of participants to display */
  participants: AvatarStackParticipant[];
  /** Maximum visible avatars before showing +N (default: 5) */
  maxVisible?: number;
  /** Avatar size variant */
  size?: "sm" | "md";
  /** Additional className */
  className?: string;
}

const sizeClasses = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
} as const;

export function AvatarStack({
  participants,
  maxVisible = 5,
  size = "sm",
  className,
}: AvatarStackProps) {
  const visibleParticipants = participants.slice(0, maxVisible);
  const overflowCount = participants.length - maxVisible;

  // Get initials from name
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0]?.charAt(0).toUpperCase() || "?";
    }
    return (
      (parts[0]?.charAt(0) || "") + (parts[parts.length - 1]?.charAt(0) || "")
    ).toUpperCase();
  };

  if (participants.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("flex items-center -space-x-2", className)}
      role="group"
      aria-label={`${participants.length} participants`}
    >
      {visibleParticipants.map((participant, index) => (
        <Avatar
          key={`${participant.name}-${index}`}
          className={cn(
            sizeClasses[size],
            "ring-background ring-2",
            // Higher z-index for earlier items so they appear on top
            `z-[${maxVisible - index}]`
          )}
          style={{ zIndex: maxVisible - index }}
        >
          {participant.avatarUrl ? (
            <AvatarImage src={participant.avatarUrl} alt={participant.name} />
          ) : null}
          <AvatarFallback className={sizeClasses[size]}>
            {getInitials(participant.name)}
          </AvatarFallback>
        </Avatar>
      ))}

      {overflowCount > 0 && (
        <div
          className={cn(
            sizeClasses[size],
            "bg-muted text-muted-foreground ring-background flex shrink-0 items-center justify-center rounded-full font-medium ring-2"
          )}
          style={{ zIndex: 0 }}
          aria-label={`+${overflowCount} more participants`}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
