// features/landing/ui/components/ReplyLink.tsx
"use client";

import Link from "next/link";
import { cn } from "@/shared/lib/utils/utils";

interface ReplyLinkProps {
  screenName: string;
  className?: string;
}

export function ReplyLink({ screenName, className }: ReplyLinkProps) {
  return (
    <Link
      href={`https://x.com/${screenName}`}
      className={cn("font-mono text-foreground hover:underline", className)}
      onClick={(e) => e.stopPropagation()}
    >
      @{screenName}
    </Link>
  );
}
