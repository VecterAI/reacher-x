"use client";

import * as React from "react";
import type { TourStepDef } from "@/shared/ui/components/Tour";

// Generate steps. On mobile, steps 6 and 7 should both point to the sidebar trigger
// so users learn how to open the sidebar to reach the keyword menu and workspace.
export function getSearchSteps(isMobile: boolean = false): TourStepDef[] {
  const steps: TourStepDef[] = [
    {
      target: "#rx-tour-exact-toggle",
      step: (
        <div>
          <div className="text-xs text-muted-foreground">1 / 7</div>
          <h3 className="text-sm font-medium">Exact Phrase Match</h3>
          <p className="text-xs">
            Toggle this to search for the exact phrase you typed. Toggle this
            off for broader search.
          </p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: "#rx-tour-filter",
      step: (
        <div>
          <div className="text-xs text-muted-foreground">2 / 7</div>
          <h3 className="text-sm font-medium">Filter</h3>
          <p className="text-xs">
            Filter results by users, dates, media, and more.
          </p>
        </div>
      ),
    },
    {
      target: "#rx-tour-sort",
      step: (
        <div>
          <div className="text-xs text-muted-foreground">3 / 7</div>
          <h3 className="text-sm font-medium">Sort</h3>
          <p className="text-xs">Sort results by relevance or recency.</p>
        </div>
      ),
    },
    {
      target: "#rx-tour-reply",
      step: (
        <div>
          <div className="text-xs text-muted-foreground">4 / 7</div>
          <h3 className="text-sm font-medium">Reply</h3>
          <p className="text-xs">Open the thread to respond quickly.</p>
        </div>
      ),
    },
    {
      target: "#rx-tour-vote",
      step: (
        <div>
          <div className="text-xs text-muted-foreground">5 / 7</div>
          <h3 className="text-sm font-medium">Vote</h3>
          <p className="text-xs">
            Upvote or downvote to teach ReacherX what&apos;s useful.
          </p>
        </div>
      ),
    },
    {
      target: isMobile ? "#rx-tour-sidebar-trigger" : "#rx-tour-keyword-menu",
      step: (
        <div>
          <div className="text-xs text-muted-foreground">6 / 7</div>
          <h3 className="text-sm font-medium">Pin Keywords</h3>
          <p className="text-xs">
            {isMobile
              ? "Open the sidebar from here, then pin best keywords."
              : "Use the three-dot menu to pin best keywords."}
          </p>
        </div>
      ),
      placement: isMobile ? "bottom" : undefined,
    },
    {
      target: isMobile ? "#rx-tour-sidebar-trigger" : "#rx-tour-workspace",
      step: (
        <div>
          <div className="text-xs text-muted-foreground">7 / 7</div>
          <h3 className="text-sm font-medium">Workspace</h3>
          <p className="text-xs">
            {isMobile
              ? "Open the sidebar from here, then go to Workspace."
              : "Access and manage your workspace from here."}
          </p>
        </div>
      ),
      placement: isMobile ? "bottom" : undefined,
    },
  ];
  return steps;
}
