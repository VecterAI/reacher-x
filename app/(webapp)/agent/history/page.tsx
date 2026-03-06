"use client";

/**
 * Mobile History Page
 *
 * Dedicated page for thread history on mobile devices.
 * Uses the same HistoryPanel component as desktop.
 */

import { useRouter } from "next/navigation";
import { useQueryStates, parseAsString } from "nuqs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { HistoryPanel } from "@/features/agent/ui/components";

export default function AgentHistoryPage() {
  const router = useRouter();

  // URL params via nuqs
  const [{ prospectId }] = useQueryStates({
    prospectId: parseAsString,
  });

  const createThread = useMutation(api.chat.createProspectThread);

  const handleNewThread = async () => {
    if (!prospectId) return;
    const result = await createThread({
      prospectId: prospectId as Id<"prospects">,
    });
    router.push(`/agent?prospectId=${prospectId}&threadId=${result.threadId}`);
  };

  const handleSelectThread = (threadId: string) => {
    router.push(`/agent?prospectId=${prospectId}&threadId=${threadId}`);
  };

  const handleClose = () => {
    router.back();
  };

  if (!prospectId) {
    return (
      <PageLayout>
        <PageHeader title="History" onBack={handleClose} />
        <PageContent>
          <p className="text-muted-foreground py-8 text-center text-sm">
            No prospect selected
          </p>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <HistoryPanel
      prospectId={prospectId as Id<"prospects">}
      onClose={handleClose}
      onSelectThread={handleSelectThread}
      onNewThread={handleNewThread}
      className="max-w-none"
    />
  );
}
