/**
 * Prospect Profile Page
 * Dedicated page view for a single prospect profile.
 * Route: /prospects/[id]
 *
 * Features:
 * - Full-width profile panel on initial load
 * - Two-column layout when sub-panels (Twitter, Evidence, Finance) are opened
 */
"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { ProspectProfilePanel } from "@/features/prospects/ui/components/ProspectProfilePanel";
import { ProspectPanelRenderer } from "@/features/prospects/ui/components/ProspectPanelRenderer";
import {
  usePanelStack,
  useProspectProfile,
} from "@/features/prospects/contexts";
import { cn } from "@/shared/lib/utils";

interface ProspectPageProps {
  params: Promise<{ id: string }>;
}

export default function ProspectPage({ params }: ProspectPageProps) {
  const router = useRouter();
  const { id } = use(params);
  const { currentPanel, depth } = usePanelStack();
  const { prospect, loading, openProspect } = useProspectProfile();

  // Load prospect data when page loads
  useEffect(() => {
    if (id) {
      openProspect(id as Id<"prospects">);
    }
  }, [id, openProspect]);

  // Handle Chat with Agent - include prospectId for context
  const handleChatWithAgent = () => {
    if (id) {
      router.push(`/agent?prospectId=${id}`);
    }
  };

  // Handle back navigation - go back in browser history
  const handleBack = () => {
    router.back();
  };

  // Check if a sub-panel is open (any panel on stack, since main profile is rendered directly, not via stack)
  const hasSubPanel = depth >= 1 && currentPanel?.type !== "prospect-profile";

  if (!prospect && !loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="font-medium">Prospect not found</p>
          <button
            onClick={handleBack}
            className="text-primary mt-2 text-sm hover:underline"
          >
            Back to prospects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* Left side: Main prospect profile */}
      <ProspectProfilePanel
        prospect={prospect || undefined}
        loading={loading}
        onChatWithAgent={handleChatWithAgent}
        onBack={handleBack}
        disableMobileDrawer={true}
        className={cn(
          "h-full min-h-0 w-full shrink-0 overflow-hidden",
          hasSubPanel && "hidden border-r md:block md:max-w-lg"
        )}
      />

      {/* Right side: Sub-panel (Twitter, Evidence, Finance) */}
      {hasSubPanel && (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ProspectPanelRenderer className="w-full" />
        </div>
      )}
    </div>
  );
}
