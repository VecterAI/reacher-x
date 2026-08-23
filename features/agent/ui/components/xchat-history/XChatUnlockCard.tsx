"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/shared/ui/components/InputOTP";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { Spinner } from "@/shared/ui/components/Spinner";
import { XChatIcon } from "@/shared/ui/components/icons";
import {
  decryptXChatInBrowser,
  getXChatRateLimitState,
  getXChatUnlockErrorMessage,
  hasUnlockedXChatSession,
  setXChatBrowserSessionState,
  useXChatBrowserSession,
  useXChatBrowserSessionState,
  useXChatRetryCooldown,
  type XChatDecryptBundle,
  type XChatDecryptBundleResponse,
} from "@/features/agent/lib/xChatBrowserSession";
import type { LockedXChatToolEvidence } from "@/features/agent/lib/xChatToolEvidence";

const MAX_SHARED_XCHAT_MESSAGES = 100;
const XCHAT_PIN_LENGTH = 4;

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
  const getEncryptedMedia = useAction(api.x.getXChatEncryptedMedia);
  const initiateAnalysis = useMutation(api.chat.initiateSharedXChatAnalysis);
  const streamAnalysis = useAction(api.chat.streamSharedXChatResponse);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const bundleRef = useRef<XChatDecryptBundle | null>(null);
  const unlockInFlightRef = useRef(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prospectId = selectedContext?.prospectId ?? null;
  const browserSession = useXChatBrowserSession({ prospectId });
  const sessionState = useXChatBrowserSessionState(prospectId);
  const isCoolingDown = useXChatRetryCooldown(
    sessionState.status === "rate_limited" ? sessionState.retryAt : undefined
  );
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
      getEncryptedMedia: async (mediaHashKey) =>
        await getEncryptedMedia({
          prospectId: prospectId as Id<"prospects">,
          mediaHashKey,
        }),
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
    if (isCoolingDown) {
      return;
    }
    if (browserSession) {
      return;
    }
    setXChatBrowserSessionState(prospectId, { status: "checking" });
    setIsUnlocking(true);
    try {
      const response = (await getDecryptBundle({
        prospectId,
      })) as XChatDecryptBundleResponse;
      if (response.availability === "unavailable") {
        bundleRef.current = null;
        setXChatBrowserSessionState(prospectId, { status: "unavailable" });
        setOpen(false);
        return;
      }
      if (response.availability === "blocked") {
        bundleRef.current = null;
        setXChatBrowserSessionState(prospectId, {
          status: "configuration_required",
        });
        return;
      }
      const nextBundle = response;
      bundleRef.current = nextBundle;
      if (hasUnlockedXChatSession(nextBundle)) {
        await decryptBundle(nextBundle, "");
      } else {
        setXChatBrowserSessionState(prospectId, { status: "locked" });
      }
    } catch (prepareError) {
      const message = "We couldn't check XChat messages. Try again.";
      setXChatBrowserSessionState(
        prospectId,
        getXChatRateLimitState(prepareError) ?? { status: "error", message }
      );
      setError(message);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleUnlock = async (completedPin: string) => {
    if (!prospectId) {
      setError("The selected prospect could not be resolved for this task.");
      return;
    }
    if (
      completedPin.length !== XCHAT_PIN_LENGTH ||
      isCoolingDown ||
      isUnlocking ||
      unlockInFlightRef.current
    ) {
      return;
    }
    unlockInFlightRef.current = true;
    setXChatBrowserSessionState(prospectId, { status: "unlocking" });
    setIsUnlocking(true);
    setError(null);
    try {
      const cachedBundle = bundleRef.current;
      const response = cachedBundle
        ? ({ availability: "available", ...cachedBundle } as const)
        : ((await getDecryptBundle({
            prospectId,
          })) as XChatDecryptBundleResponse);
      if (response.availability === "unavailable") {
        bundleRef.current = null;
        setPin("");
        setXChatBrowserSessionState(prospectId, { status: "unavailable" });
        setOpen(false);
        return;
      }
      if (response.availability === "blocked") {
        bundleRef.current = null;
        setPin("");
        setXChatBrowserSessionState(prospectId, {
          status: "configuration_required",
        });
        return;
      }
      const nextBundle = response;
      await decryptBundle(nextBundle, completedPin);
    } catch (unlockError) {
      setPin("");
      const message = getXChatUnlockErrorMessage(unlockError);
      setXChatBrowserSessionState(
        prospectId,
        getXChatRateLimitState(unlockError) ?? { status: "locked" }
      );
      setError(message);
    } finally {
      unlockInFlightRef.current = false;
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

  const hasReadableMessages = messages.length > 0;
  const isXChatAccessDenied = sessionState.status === "configuration_required";
  const statusLabel = `Encrypted messages · ${evidence.eventCount} found · ${evidence.inboundEventCount} received · ${evidence.outboundEventCount} sent`;

  return (
    <div className="space-y-2">
      {browserSession ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => void handleOpen()}
        >
          Share XChat messages
        </Button>
      ) : (
        <InlineFeatureStrip
          leading={
            <>
              <div className="border-border shrink-0 rounded-md border p-1">
                <XChatIcon
                  className="text-foreground size-4"
                  aria-hidden="true"
                />
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
              disabled={
                (!prospectId && selectedContext !== undefined) || isCoolingDown
              }
            >
              Unlock
            </Button>
          }
        />
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {!browserSession
                ? "Enter your XChat PIN"
                : hasReadableMessages
                  ? "Share unlocked messages"
                  : "XChat unlocked"}
            </DialogTitle>
            <DialogDescription
              id="xchat-pin-privacy"
              className={!browserSession ? "sr-only" : undefined}
            >
              {!browserSession
                ? "Enter your four-digit XChat PIN."
                : hasReadableMessages
                  ? `Share up to the latest ${MAX_SHARED_XCHAT_MESSAGES} messages with the Agent for this response.`
                  : "The messages already visible in the thread remain available. This unlock did not add any additional XChat rows to share for this response."}
            </DialogDescription>
          </DialogHeader>

          {isXChatAccessDenied ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                X accepted the connected account but denied this app access to
                encrypted XChat endpoints. Reconnect X once; if this remains,
                contact X Developer support.
              </p>
              <DialogFooter>
                <Button asChild size="xs">
                  <Link href="/settings/connected-accounts">
                    Connected accounts
                  </Link>
                </Button>
              </DialogFooter>
            </div>
          ) : !browserSession ? (
            <form
              className="space-y-3"
              aria-busy={isUnlocking}
              onSubmit={(event) => {
                event.preventDefault();
                void handleUnlock(pin);
              }}
            >
              <label htmlFor="xchat-agent-pin" className="sr-only">
                XChat PIN
              </label>
              <div className="relative mx-auto h-11 w-44">
                <InputOTP
                  id="xchat-agent-pin"
                  value={pin}
                  onChange={setPin}
                  onComplete={(completedPin) => void handleUnlock(completedPin)}
                  maxLength={XCHAT_PIN_LENGTH}
                  pattern={REGEXP_ONLY_DIGITS}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  autoFocus
                  disabled={isUnlocking || isCoolingDown}
                  aria-invalid={Boolean(error)}
                  aria-describedby="xchat-pin-privacy"
                  containerClassName="justify-center has-disabled:opacity-100"
                >
                  <InputOTPGroup
                    className={`transition-opacity duration-150 ${
                      isUnlocking ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    {Array.from({ length: XCHAT_PIN_LENGTH }, (_, index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                {isUnlocking ? (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    role="status"
                  >
                    <Spinner
                      variant="circle"
                      className="size-5"
                      aria-hidden="true"
                    />
                    <span className="sr-only">Unlocking XChat messages</span>
                  </div>
                ) : null}
              </div>
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
                  disabled={isUnlocking || isCoolingDown}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          ) : !hasReadableMessages ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm" role="status">
                The conversation is already visible above. This unlock only adds
                encrypted XChat rows when they are available.
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
                >
                  Cancel
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <InlineFeatureStrip
                leading={
                  <>
                    <div className="border-border shrink-0 rounded-md border p-1">
                      <XChatIcon
                        className="text-foreground size-4"
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
