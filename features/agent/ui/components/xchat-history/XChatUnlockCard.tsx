"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { Badge } from "@/shared/ui/components/Badge";
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
import {
  decryptXChatInBrowser,
  hasUnlockedXChatSession,
  lockXChatInBrowser,
  useXChatBrowserSession,
  type XChatDecryptBundle,
} from "@/features/agent/lib/xChatBrowserSession";
import type { LockedXChatToolEvidence } from "@/features/agent/lib/xChatToolEvidence";

const MAX_SHARED_XCHAT_MESSAGES = 100;

export function XChatUnlockCard({
  threadId,
  evidence,
}: {
  threadId: string;
  evidence: LockedXChatToolEvidence;
}) {
  const selectedContext = useQuery(api.chat.getThreadSelectedContext, {
    threadId,
  });
  const getDecryptBundle = useAction(api.x.getXChatDecryptBundle);
  const getRealmAuthToken = useAction(api.x.getXChatRealmAuthToken);
  const initiateAnalysis = useMutation(api.chat.initiateSharedXChatAnalysis);
  const streamAnalysis = useAction(api.chat.streamSharedXChatResponse);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [bundle, setBundle] = useState<XChatDecryptBundle | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prospectId = selectedContext?.prospectId ?? null;
  const browserSession = useXChatBrowserSession({ prospectId });
  const messages = browserSession?.messages ?? [];
  const decryptionErrorCount = browserSession?.decryptionErrorCount ?? 0;
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setPin("");
      setError(null);
    }
  };

  const decryptBundle = async (
    nextBundle: XChatDecryptBundle,
    nextPin: string
  ) => {
    if (!prospectId) {
      throw new Error(
        "The selected prospect could not be resolved for this task."
      );
    }
    const decrypted = await decryptXChatInBrowser({
      prospectId,
      bundle: nextBundle,
      pin: nextPin,
      getRealmAuthToken: async (realmId) =>
        await getRealmAuthToken({ realmId }),
    });
    setPin("");
    setBundle(nextBundle);
    if (decrypted.messages.length === 0) {
      setError(
        "XChat unlocked, but no verified text messages could be decrypted from this history window."
      );
    }
  };

  const handleOpen = async () => {
    setOpen(true);
    setError(null);
    if (!prospectId) {
      return;
    }
    if (browserSession) {
      return;
    }
    setIsUnlocking(true);
    try {
      const nextBundle = (await getDecryptBundle({
        prospectId,
      })) as XChatDecryptBundle;
      setBundle(nextBundle);
      if (hasUnlockedXChatSession(nextBundle)) {
        await decryptBundle(nextBundle, "");
      }
    } catch (prepareError) {
      setError(
        prepareError instanceof Error
          ? prepareError.message
          : "XChat could not be prepared."
      );
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleUnlock = async () => {
    if (!prospectId) {
      setError("The selected prospect could not be resolved for this task.");
      return;
    }
    setIsUnlocking(true);
    setError(null);
    try {
      const nextBundle =
        bundle ??
        ((await getDecryptBundle({ prospectId })) as XChatDecryptBundle);
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

  const handleShare = async () => {
    if (!prospectId || !browserSession || messages.length === 0) {
      return;
    }
    setIsSharing(true);
    setError(null);
    const sharedMessages = messages.slice(-MAX_SHARED_XCHAT_MESSAGES);
    const coverageComplete =
      !browserSession.hasMore &&
      messages.length <= MAX_SHARED_XCHAT_MESSAGES &&
      decryptionErrorCount === 0;
    try {
      const prompt = `Analyze the XChat conversation I unlocked with ${evidence.prospectName}. Summarize what happened and assess whether my responses were appropriate in context.`;
      const saved = await initiateAnalysis({
        threadId,
        prospectId: prospectId as Id<"prospects">,
        prompt,
      });
      setBundle(null);
      setOpen(false);
      toast.success("XChat shared for this Agent response");
      void streamAnalysis({
        threadId,
        promptMessageId: saved.messageId,
        context: {
          prospectId: prospectId as Id<"prospects">,
          conversationId: browserSession.conversationId,
          decryptedAt: getCurrentUTCTimestamp(),
          coverageComplete,
          messages: sharedMessages,
        },
      })
        .catch((streamError) => {
          toast.error("The Agent could not analyze XChat", {
            description:
              streamError instanceof Error
                ? streamError.message
                : "Please try again.",
          });
        })
        .finally(() => setIsSharing(false));
    } catch (shareError) {
      setIsSharing(false);
      setError(
        shareError instanceof Error
          ? shareError.message
          : "XChat could not be shared with the Agent."
      );
    }
  };

  const handleLock = () => {
    lockXChatInBrowser();
    setBundle(null);
    setPin("");
    setError(null);
  };

  return (
    <section className="border-border bg-card rounded-lg border p-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md">
            <LockKeyhole className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-medium">Encrypted XChat found</h4>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {evidence.eventCount} encrypted events:{" "}
              {evidence.inboundEventCount} inbound and{" "}
              {evidence.outboundEventCount} outbound.
            </p>
          </div>
        </div>
        <Badge variant="outline">XChat</Badge>
      </header>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="xs"
          onClick={() => void handleOpen()}
          disabled={!prospectId && selectedContext !== undefined}
        >
          {browserSession ? "Review unlocked XChat" : "Unlock and analyze"}
        </Button>
      </div>

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

          {!browserSession ? (
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
                  aria-describedby="xchat-pin-privacy"
                />
              </label>
              {isUnlocking && !bundle ? (
                <p className="text-muted-foreground text-sm" role="status">
                  Preparing encrypted history…
                </p>
              ) : null}
              <p
                id="xchat-pin-privacy"
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
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/40 flex items-start gap-2 rounded-md border p-3">
                <ShieldCheck
                  className="text-primary mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-sm leading-5">
                  {messages.length} verified text messages are ready. Sharing
                  sends only the latest {MAX_SHARED_XCHAT_MESSAGES} messages to
                  the Agent for this response.
                </p>
              </div>
              <p className="text-muted-foreground text-xs leading-5">
                The model provider will receive the shared text. ReacherX does
                not store that plaintext in message context or raw-model
                telemetry, although the Agent&apos;s resulting answer remains in
                this task.
              </p>
              {browserSession?.hasMore ? (
                <p className="text-muted-foreground text-xs leading-5">
                  This XChat window is partial; additional encrypted events
                  remain available on X.
                </p>
              ) : null}
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
                  disabled={isSharing}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLock}
                  disabled={isSharing}
                >
                  Lock XChat
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleShare()}
                  disabled={isSharing || messages.length === 0}
                >
                  {isSharing ? "Sharing…" : "Share with Agent"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
