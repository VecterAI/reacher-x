"use client";

import { useState } from "react";
import { ConvexProviderWithAuth } from "convex/react";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { LinkedInConversationPanel } from "@/features/prospects/ui/components/LinkedInConversationPanel";
import { Button } from "@/shared/ui/components/Button";
import { createServices } from "./conversationServices";

const auth = {
  isLoading: false,
  isAuthenticated: true,
  fetchAccessToken: async () => null,
};
function useLocalAuth() {
  return auth;
}

export function ConversationHarness() {
  const [services] = useState(createServices);
  return (
    <AuthKitProvider initialAuth={{ user: null }} onSessionExpired={false}>
      <ConvexProviderWithAuth client={services.client} useAuth={useLocalAuth}>
        <main className="bg-background text-foreground flex min-h-dvh flex-col items-center gap-4 p-4">
          <header className="flex items-center gap-4">
            <h1 className="text-sm">Unchanged production conversation panel</h1>
            <Button size="sm" variant="outline" onClick={services.failNextSend}>
              Fail next send
            </Button>
          </header>
          <section
            aria-label="Conversation experiment"
            className="border-border h-[720px] max-h-[85dvh] w-full max-w-lg overflow-hidden border"
          >
            <LinkedInConversationPanel prospectId="experiment-prospect" />
          </section>
        </main>
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}
