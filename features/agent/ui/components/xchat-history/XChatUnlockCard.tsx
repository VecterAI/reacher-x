"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
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
  const bundleRef = useRef<XChatDecryptBundle | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prospectId = selectedContext?.prospectId ?? null;
  const browserSession = useXChatBrowserSession({ prospectId });
  const messages = browserSession?.messages ?? [];
  const decryptionErrorCount = browserSession?.decryptionErrorCount ?? 0;

  useEffect(() => {
    bundleRef.current = null;
  }, [prospectId]);

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
    bundleRef.current = nextBundle;
    setError(null);
    return decrypted.messages.length;
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
      bundleRef.current = nextBundle;
      if (hasUnlockedXChatSession(nextBundle)) {
        await decryptBundle(nextBundle, "");
      }
    } catch (prepareError) {
      setError(
        prepareError instanceof Error
          ? prepareError.message
          : "Couldn't prepare encrypted messages."
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
        bundleRef.current ??
        ((await getDecryptBundle({ prospectId })) as XChatDecryptBundle);
      await decryptBundle(nextBundle, pin);
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
      bundleRef.current = null;
      setOpen(false);
      toast.success("Messages shared with the Agent");
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
          toast.error("The Agent couldn't analyze these messages", {
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
          : "Couldn't share messages with the Agent."
      );
    }
  };

  const handleLock = () => {
    lockXChatInBrowser();
    bundleRef.current = null;
    setPin("");
    setError(null);
    setOpen(false);
  };

  const hasReadableMessages = messages.length > 0;
  const statusLabel = browserSession
    ? hasReadableMessages
      ? `XChat unlocked · ${messages.length} ready to share`
      : "XChat unlocked"
    : `Encrypted messages · ${evidence.eventCount} found · ${evidence.inboundEventCount} received · ${evidence.outboundEventCount} sent`;

  return (
    <div className="space-y-2">
      <InlineFeatureStrip
        leading={
          <>
            <div className="border-border shrink-0 rounded-md border p-1">
              {browserSession ? (
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
          <Button
            type="button"
            size="xs"
            onClick={() => void handleOpen()}
            disabled={!prospectId && selectedContext !== undefined}
          >
            {browserSession ? "Review" : "Unlock"}
          </Button>
        }
      />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {!browserSession
                ? "Unlock messages"
                : hasReadableMessages
                  ? "Share unlocked messages"
                  : "XChat unlocked"}
            </DialogTitle>
            <DialogDescription>
              {!browserSession
                ? "Enter your XChat PIN. It stays in this browser and is never sent to ReacherX."
                : hasReadableMessages
                  ? `Share up to the latest ${MAX_SHARED_XCHAT_MESSAGES} messages with the Agent for this response.`
                  : "The messages already visible in the thread remain available. This unlock did not add any additional XChat rows to share for this response."}
            </DialogDescription>
          </DialogHeader>

          {!browserSession ? (
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
                  aria-describedby="xchat-pin-privacy"
                />
              </label>
              <p
                id="xchat-pin-privacy"
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
          ) : !hasReadableMessages ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm" role="status">
                The conversation is already visible above. This unlock only adds
                encrypted XChat rows when they are available.
              </p>
              {browserSession.hasMore ? (
                <p className="text-muted-foreground text-xs leading-5">
                  More encrypted history is available on X.
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
                  size="xs"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleLock}
                >
                  Lock
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <InlineFeatureStrip
                leading={
                  <>
                    <div className="border-border shrink-0 rounded-md border p-1">
                      <LockOpenRightIcon
                        className="text-foreground size-4 fill-current"
                        aria-hidden="true"
                      />
                    </div>
                    <span className="min-w-0 truncate text-sm font-medium">
                      {messages.length} messages ready · Latest{" "}
                      {MAX_SHARED_XCHAT_MESSAGES} shared
                    </span>
                  </>
                }
              />
              <p className="text-muted-foreground text-xs leading-5">
                Shared text goes to the model for this response. ReacherX does
                not keep that plaintext.
              </p>
              {browserSession?.hasMore ? (
                <p className="text-muted-foreground text-xs leading-5">
                  More encrypted history is available on X.
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
                  size="xs"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSharing}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleLock}
                  disabled={isSharing}
                >
                  Lock
                </Button>
                <Button
                  type="button"
                  size="xs"
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
    </div>
  );
}
