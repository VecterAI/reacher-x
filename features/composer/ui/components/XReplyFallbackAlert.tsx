"use client";

import { buildTwitterPostUrl } from "@/shared/lib/twitter/contracts";
import { cn } from "@/shared/lib/utils";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button } from "@/shared/ui/components/Button";

interface XReplyFallbackAlertProps {
  postId?: string | null;
  authorHandle?: string | null;
  className?: string;
}

export function XReplyFallbackAlert({
  postId,
  authorHandle,
  className,
}: XReplyFallbackAlertProps) {
  if (!postId) {
    return null;
  }

  const postUrl = buildTwitterPostUrl({
    postId,
    authorHandle: authorHandle ?? undefined,
  });

  return (
    <Alert className={cn(className)}>
      <AlertTitle>Note</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          X may block replies sent through 🆁 ReacherX. If that happens, you can
          reply directly on X/Twitter.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="xs">
            <a href={postUrl} target="_blank" rel="noopener noreferrer">
              Reply on X/Twitter
            </a>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
