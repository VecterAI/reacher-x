"use client";

import type { ReactNode } from "react";

import { AgentWorkingMark } from "@/shared/ui/components/AgentWorkingMark";

interface AgentWorkspaceEmptyStateProps {
  children: ReactNode;
  isResolving: boolean;
  /** Optional visible headline above the composer (setup empty entry). */
  headline?: string;
}

export function AgentWorkspaceEmptyState({
  children,
  isResolving,
  headline,
}: AgentWorkspaceEmptyStateProps) {
  const showAgentMark = !headline;

  return (
    <section aria-labelledby="agent-empty-state-title" className="py-6">
      {/* Normal /agent always owns the mark. Setup entry owns the headline. */}
      {showAgentMark ? (
        <div className="mb-4 flex justify-center" aria-hidden="true">
          <AgentWorkingMark isResolving={isResolving} />
        </div>
      ) : null}

      <h2
        id="agent-empty-state-title"
        className={
          headline
            ? "font-pixel-square text-foreground mb-4 text-center text-2xl font-medium tracking-tight text-pretty sm:text-3xl"
            : "sr-only"
        }
      >
        {headline ?? "Start a conversation with △ Agent"}
      </h2>

      <div className="text-left">{children}</div>
    </section>
  );
}
