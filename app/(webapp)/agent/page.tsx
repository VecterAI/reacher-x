"use client";

/**
 * Agent Chat Page
 *
 * This page renders the AgentChat component for:
 * - New user onboarding
 * - v3 → v4 migration
 * - General agent conversations
 *
 * Uses PageLayout for consistent width with other pages.
 */

import { AgentChat } from "@/features/agent/ui/AgentChat";
import {
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";

export default function AgentPage() {
  return (
    <PageLayout>
      <PageContent className="h-full p-0">
        <AgentChat />
      </PageContent>
    </PageLayout>
  );
}
