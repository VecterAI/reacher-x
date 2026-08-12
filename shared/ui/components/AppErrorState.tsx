"use client";

import { Button } from "@/shared/ui/components/Button";
import { navigateDocumentIntentionally } from "@/shared/lib/convex/intentionalDocumentNavigation";
import { cn } from "@/shared/lib/utils";

interface AppErrorStateProps {
  title: string;
  description: string;
  onRetry: () => void;
  className?: string;
}

export function AppErrorState({
  title,
  description,
  onRetry,
  className,
}: AppErrorStateProps) {
  return (
    <section
      aria-labelledby="app-error-title"
      role="alert"
      className={cn("flex w-full justify-center text-center", className)}
    >
      <div className="w-full max-w-sm">
        <h1
          id="app-error-title"
          className="text-foreground text-base font-medium tracking-tight"
        >
          {title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6 text-pretty">
          {description}
        </p>
        <div className="mt-5 flex items-center justify-center gap-1.5">
          <Button type="button" variant="default" size="xs" onClick={onRetry}>
            Try again
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => navigateDocumentIntentionally("/")}
          >
            Dashboard
          </Button>
        </div>
      </div>
    </section>
  );
}
