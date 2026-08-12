"use client";

import * as React from "react";
import { useAction } from "convex/react";
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
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { LockIcon, LockOpenRightIcon } from "@/shared/ui/components/icons";

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
  const preparedTargetKeyRef = React.useRef<string | null>(null);
  const targetKey = JSON.stringify([prospectId, participantUserId ?? null]);

  const decryptBundle = React.useCallback(
    async (nextBundle: XChatDecryptBundle, nextPin: string) => {
      const decrypted = await decryptXChatInBrowser({
        prospectId,
        bundle: nextBundle,
        pin: nextPin,
        getRealmAuthToken: async (realmId) =>
          await getRealmAuthToken({ realmId }),
      });
      if (preparedTargetKeyRef.current !== targetKey) {
        return null;
      }
      setPin("");
      setBundle(nextBundle);
      setError(null);
      return decrypted.messages.length;
    },
    [getRealmAuthToken, prospectId, targetKey]
  );

  const prepareBundle = React.useCallback(async () => {
    const requestedTargetKey = targetKey;
    setAvailability("checking");
    setError(null);
    try {
      const nextBundle = (await getDecryptBundle({
        prospectId: prospectId as Id<"prospects">,
      })) as XChatDecryptBundle;
      if (preparedTargetKeyRef.current !== requestedTargetKey) {
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
      if (preparedTargetKeyRef.current !== requestedTargetKey) {
        return null;
      }
      setAvailability("failed");
      setError("Couldn't check encrypted messages. Please try again.");
      return null;
    }
  }, [decryptBundle, getDecryptBundle, prospectId, targetKey]);

  React.useEffect(() => {
    if (preparedTargetKeyRef.current === targetKey) {
      return;
    }
    preparedTargetKeyRef.current = targetKey;
    setBundle(null);
    setError(null);
    setAvailability("checking");
    void prepareBundle();
  }, [prepareBundle, targetKey]);

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
        setError("No encrypted messages are available for this prospect.");
        return;
      }
      const messageCount = await decryptBundle(nextBundle, pin);
      if (messageCount !== null) {
        setOpen(false);
      }
    } catch (unlockError) {
      setPin("");
      setError(
        unlockError instanceof Error
          ? unlockError.message
          : "Couldn't unlock messages."
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

  if (session && !open) {
    return null;
  }

  const hasPartialCoverage = session?.hasMore ?? bundle?.hasMore ?? false;
  if (availability === "unavailable" && !session) {
    return null;
  }

  const statusLabel = session
    ? `XChat unlocked${hasPartialCoverage ? " · More on X" : ""}`
    : availability === "failed"
      ? "Couldn't check encrypted messages"
      : availability === "checking"
        ? "Checking encrypted messages…"
        : hasPartialCoverage
          ? "Encrypted messages · More on X"
          : "Encrypted messages · Enter PIN to view";

  return (
    <div className="space-y-2">
      <InlineFeatureStrip
        leading={
          <>
            <div className="border-border shrink-0 rounded-md border p-1">
              {session ? (
                <LockOpenRightIcon
                  className="text-foreground size-4 fill-current"
                  aria-hidden="true"
                />
              ) : (
                <LockIcon
                  className="text-foreground size-4 fill-current"
                  aria-hidden="true"
                />
              )}
            </div>
            <span className="min-w-0 truncate text-sm font-medium">
              {statusLabel}
            </span>
          </>
        }
        trailing={
          session ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={handleLock}
            >
              Lock
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
              disabled={availability === "checking" || isUnlocking}
            >
              Unlock
            </Button>
          )
        }
      />
      {error && (availability === "failed" || session) ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock messages</DialogTitle>
            <DialogDescription>
              Enter your XChat PIN. It stays in this browser and is never sent
              to ReacherX.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            aria-busy={isUnlocking}
            onSubmit={(event) => {
              event.preventDefault();
              void handleUnlock();
            }}
          >
            <label className="space-y-1.5 text-sm font-medium">
              <span>PIN</span>
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
              Your PIN never leaves this browser.
            </p>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isUnlocking}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="xs"
                disabled={isUnlocking || !pin.trim()}
              >
                Unlock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
