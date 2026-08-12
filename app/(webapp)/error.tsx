"use client";

import { useEffect } from "react";
import { AppErrorState } from "@/shared/ui/components/AppErrorState";
import { logger } from "@/shared/lib/logger";

const webAppErrorLogger = logger.withScope("WebAppError");

export default function WebAppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    webAppErrorLogger.error("Unhandled webapp error boundary event", error);
  }, [error]);

  return (
    <AppErrorState
      className="min-h-full items-center px-6 py-16"
      title="We couldn’t load this view."
      description="Please try again, or return to your dashboard."
      onRetry={unstable_retry}
    />
  );
}
