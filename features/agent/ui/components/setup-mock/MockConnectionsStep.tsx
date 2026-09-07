"use client";

import { useState } from "react";
import { LinkedInConnectNoticeDialog } from "@/features/linked-accounts/ui/components";
import { ConnectionsStepContent } from "../onboarding/ConnectionsStepContent";

/** Uses the live step's presentation with local connections instead of OAuth. */
export function MockConnectionsStep({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [connectedLinkedIn, setConnectedLinkedIn] = useState(false);
  const [linkedInDialogOpen, setLinkedInDialogOpen] = useState(false);

  return (
    <ConnectionsStepContent
      accounts={{
        loading: false,
        googleEmail: "demo@example.com",
        isGoogleConnected: true,
        xStatus: null,
        linkedinStatus: connectedLinkedIn
          ? { isConnected: true, displayName: "Demo account" }
          : null,
        // The live step automatically advances once Google and X are connected.
        onConnectX: onComplete,
        onDisconnectX: () => {},
        onConnectLinkedIn: () => setLinkedInDialogOpen(true),
        onDisconnectLinkedIn: () => setConnectedLinkedIn(false),
      }}
      isMutating={false}
      isCompletingStep={false}
      continueDisabled
      onContinue={onComplete}
      onConnectLater={onComplete}
    >
      <LinkedInConnectNoticeDialog
        open={linkedInDialogOpen}
        isSubmitting={false}
        onCancel={() => setLinkedInDialogOpen(false)}
        onContinue={() => {
          setLinkedInDialogOpen(false);
          setConnectedLinkedIn(true);
        }}
        onOpenPasswordReset={() => {
          window.open(
            "https://www.linkedin.com/checkpoint/rp/request-password-reset",
            "_blank",
            "noopener,noreferrer"
          );
        }}
      />
    </ConnectionsStepContent>
  );
}
