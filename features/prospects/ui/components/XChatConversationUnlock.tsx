"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  decryptXChatInBrowser,
  hasUnlockedXChatSession,
  lockXChatInBrowser,
  useXChatBrowserSession,
  type XChatDecryptBundle,
} from "@/features/agent/lib/xChatBrowserSession";
import { Button } from "@/shared/ui/components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/Dialog";
import { Input } from "@/shared/ui/components/Input";

type XChatAvailability = "checking" | "available" | "unavailable" | "failed";

function hasEncryptedEvents(bundle: XChatDecryptBundle): boolean {
  return bundle.events.some((event) => event.encodedEvent.trim().length > 0);
}

/**
 * Browser-only XChat unlock control for the X conversation panel. It shares
 * verified plaintext through xChatBrowserSession, never through Convex.
 */
export function XChatConversationUnlock({
  prospectId,
  participantUserId,
}: {
  prospectId: string;
  participantUserId?: string | null;
}) {
  const getDecryptBundle = useAction(api.x.getXChatDecryptBundle);
  const getRealmAuthToken = useAction(api.x.getXChatRealmAuthToken);
  const session = useXChatBrowserSession({ prospectId, participantUserId });
  const [availability, setAvailability] =
    React.useState<XChatAvailability>("checking");
  const [bundle, setBundle] = React.useState<XChatDecryptBundle | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pin, setPin] = React.useState("");
  const [isUnlocking, setIsUnlocking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const preparedProspectIdRef = React.useRef<string | null>(null);

  const decryptBundle = React.useCallback(
    async (nextBundle: XChatDecryptBundle, nextPin: string) => {
      const decrypted = await decryptXChatInBrowser({
        prospectId,
        bundle: nextBundle,
        pin: nextPin,
        getRealmAuthToken: async (realmId) =>
          await getRealmAuthToken({ realmId }),
      });
      if (preparedProspectIdRef.current !== prospectId) {
        return;
      }
      setPin("");
      setBundle(nextBundle);
      if (decrypted.messages.length === 0) {
        setError(
          "XChat unlocked, but no verified text messages could be decrypted from this history window."
        );
      }
    },
    [getRealmAuthToken, prospectId]
  );

  const prepareBundle = React.useCallback(async () => {
    const requestedProspectId = prospectId;
    setAvailability("checking");
    setError(null);
    try {
      const nextBundle = (await getDecryptBundle({
        prospectId: prospectId as Id<"prospects">,
      })) as XChatDecryptBundle;
      if (preparedProspectIdRef.current !== requestedProspectId) {
        return null;
      }
      setBundle(nextBundle);
      if (!hasEncryptedEvents(nextBundle)) {
        setAvailability("unavailable");
        return null;
      }
      setAvailability("available");
      if (hasUnlockedXChatSession(nextBundle)) {
        await decryptBundle(nextBundle, "");
      }
      return nextBundle;
    } catch {
      if (preparedProspectIdRef.current !== requestedProspectId) {
        return null;
      }
      setAvailability("failed");
      setError("XChat history could not be checked. Please try again.");
      return null;
    }
  }, [decryptBundle, getDecryptBundle, prospectId]);

  React.useEffect(() => {
    if (preparedProspectIdRef.current === prospectId) {
      return;
    }
    preparedProspectIdRef.current = prospectId;
    setBundle(null);
    setError(null);
    setAvailability("checking");
    void prepareBundle();
  }, [prepareBundle, prospectId]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setPin("");
      setError(null);
    }
  };

  const handleUnlock = async () => {
    setIsUnlocking(true);
    setError(null);
    try {
      const nextBundle = bundle ?? (await prepareBundle());
      if (!nextBundle || !hasEncryptedEvents(nextBundle)) {
        setError("No encrypted XChat events are available for this prospect.");
        return;
      }
      await decryptBundle(nextBundle, pin);
    } catch (unlockError) {
      setPin("");
      setError(
        unlockError instanceof Error
          ? unlockError.message
          : "XChat could not be unlocked."
      );
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLock = () => {
    lockXChatInBrowser();
    setPin("");
    setError(null);
  };

  if (availability === "unavailable" && !session) {
    return null;
  }

  const hasPartialCoverage = session?.hasMore ?? bundle?.hasMore ?? false;

  return (
    <section className="border-border bg-muted/20 rounded-lg border p-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md">
            {session ? (
              <ShieldCheck className="size-4" aria-hidden="true" />
            ) : (
              <LockKeyhole className="size-4" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-medium">
              {session
                ? "XChat unlocked in this browser"
                : availability === "failed"
                  ? "XChat availability unavailable"
                  : availability === "checking"
                    ? "Checking XChat history"
                    : "Encrypted XChat"}
            </h3>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {session
                ? `${session.messages.length} verified text messages are shown below.`
                : availability === "checking"
                  ? "Checking for encrypted XChat history…"
                  : availability === "failed"
                    ? "XChat history could not be checked."
                    : "Unlock locally to view verified XChat messages in this panel."}
            </p>
          </div>
        </div>
        {session ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={handleLock}
          >
            Lock XChat
          </Button>
        ) : availability === "failed" ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => void prepareBundle()}
          >
            Retry
          </Button>
        ) : (
          <Button
            type="button"
            size="xs"
            onClick={() => setOpen(true)}
            disabled={availability === "checking"}
          >
            Unlock XChat
          </Button>
        )}
      </header>
      {hasPartialCoverage ? (
        <p className="text-muted-foreground mt-3 text-xs leading-5">
          XChat history is partially loaded; additional encrypted events remain
          available on X.
        </p>
      ) : null}
      {availability === "failed" && error ? (
        <p className="text-destructive mt-3 text-xs leading-5" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock XChat in this browser</DialogTitle>
            <DialogDescription>
              Your XChat PIN and private keys stay in browser memory. ReacherX
              fetches ciphertext, then X&apos;s Chat XDK decrypts and verifies
              it locally.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleUnlock();
            }}
          >
            <label className="space-y-1.5 text-sm font-medium">
              <span>XChat PIN</span>
              <Input
                type="password"
                value={pin}
                autoComplete="off"
                inputMode="numeric"
                onChange={(event) => setPin(event.target.value)}
                disabled={isUnlocking}
                aria-describedby="xchat-panel-pin-privacy"
              />
            </label>
            <p
              id="xchat-panel-pin-privacy"
              className="text-muted-foreground text-xs leading-5"
            >
              The PIN is never sent to ReacherX, X, analytics, or the Agent.
            </p>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isUnlocking}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUnlocking || !pin.trim()}>
                {isUnlocking ? "Unlocking…" : "Unlock XChat"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
