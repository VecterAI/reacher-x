"use client";

import { useEffect } from "react";
import { AppErrorState } from "@/shared/ui/components/AppErrorState";
import { logger } from "@/shared/lib/logger";
import { geistMono, geistPixelSquare, geistSans } from "./fonts";
import "./globals.css";

const globalErrorLogger = logger.withScope("GlobalError");

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    globalErrorLogger.error("Unhandled global error boundary event", error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${geistPixelSquare.variable} bg-background text-foreground antialiased`}
      >
        <title>Couldn’t load ReacherX | ReacherX</title>
        <main className="flex min-h-screen items-center justify-center">
          <AppErrorState
            className="px-6 py-16"
            title="We couldn’t load this page."
            description="Please try again, or return to your dashboard."
            onRetry={unstable_retry}
          />
        </main>
      </body>
    </html>
  );
}
