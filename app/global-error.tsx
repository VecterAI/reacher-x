"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/shared/ui/components/Button";
import { logger } from "@/shared/lib/logger";
import { geistMono, geistPixelSquare, geistSans } from "./fonts";
import "./globals.css";

const globalErrorLogger = logger.withScope("GlobalError");

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
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
        <title>Something went wrong | ReacherX</title>
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="bg-background w-full max-w-xl rounded-2xl border p-6 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
              Global error
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              ReacherX ran into an unexpected failure.
            </h1>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              Try reloading the app. If the error persists, return to the
              dashboard and start a fresh session.
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
        </main>
      </body>
    </html>
  );
}
