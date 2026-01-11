import * as React from "react";
import { cn } from "@/shared/lib/utils";

export interface ThreadBodyProps {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ThreadBody({
  children,
  className,
  size = "md",
}: ThreadBodyProps) {
  const bodyClass = cn(
    size === "sm" && "text-base",
    size === "md" && "text-xl",
    size === "lg" && "text-2xl"
  );
  return (
    <p
      lang="auto"
      className={cn(
        bodyClass,
        "word-break [&_a]:text-muted-foreground hyphens-auto whitespace-pre-line [&_a]:hover:underline dark:[&_a]:text-neutral-400",
        className
      )}
    >
      {children}
    </p>
  );
}
