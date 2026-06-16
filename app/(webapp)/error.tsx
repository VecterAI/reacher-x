"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/shared/ui/components/Button";
import { logger } from "@/shared/lib/logger";

const webAppErrorLogger = logger.withScope("WebAppError");

export default function WebAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    webAppErrorLogger.error("Unhandled webapp error boundary event", error);
  }, [error]);

  return (
    <div className="flex h-full min-h-0 items-center justify-center p-6">
      <div className="bg-background w-full max-w-lg rounded-2xl border p-6 shadow-sm">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Unexpected error
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          This page hit an unexpected problem.
        </h2>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          Try reloading this part of the app. If the issue keeps happening, you
          can return to the dashboard and continue working from there.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground mt-3 font-mono text-xs">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
