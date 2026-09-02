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
  XChatPinRecoveryActions,
  XChatRememberPinOption,
  XCHAT_HELP_URL,
} from "@/features/agent/ui/components/XChatPinPreferences";
import {
  decryptXChatInBrowser,
  decryptXChatWithRememberedPin,
  getXChatRateLimitState,
  getXChatUnlockErrorMessage,
  getXChatUnlockFailureState,
  hasUnlockedXChatSession,
  rememberSuccessfulXChatPin,
  setXChatBrowserSessionState,
  useXChatBrowserSession,
  useXChatBrowserSessionState,
  useXChatRetryCooldown,
  type XChatDecryptBundle,
  type XChatDecryptBundleResponse,
} from "@/features/agent/lib/xChatBrowserSession";
import type { LockedXChatToolEvidence } from "@/features/agent/lib/xChatToolEvidence";
import {
  buildXChatAgentSharePayload,
  MAX_SHARED_XCHAT_MESSAGES,
  XCHAT_AGENT_MEDIA_LIMITATION_COPY,
} from "@/features/agent/lib/xChatAgentShare";
import { getXChatUnlockGateMode } from "@/features/prospects/lib/xChatUnlockGate";
import { forgetAllRememberedXChatPins } from "@/features/agent/lib/xChatDeviceCredentialStorage";

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
  const [rememberOnDevice, setRememberOnDevice] = useState(true);
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
        setXChatBrowserSessionState(
          prospectId,
          response.reason === "xchat_access_denied"
            ? { status: "configuration_required" }
            : { status: "dm_restricted", reason: response.reason }
        );
        return;
      }
      const nextBundle = response;
      bundleRef.current = nextBundle;
      if (hasUnlockedXChatSession(nextBundle)) {
        await decryptBundle(nextBundle, "");
      } else {
        setXChatBrowserSessionState(prospectId, { status: "unlocking" });
        const rememberedUnlock = await decryptXChatWithRememberedPin({
          prospectId,
          bundle: nextBundle,
          getRealmAuthToken: async (realmId) =>
            await getRealmAuthToken({ realmId }),
          getEncryptedMedia: async (mediaHashKey) =>
            await getEncryptedMedia({
              prospectId: prospectId as Id<"prospects">,
              mediaHashKey,
            }),
        });
        if (rememberedUnlock.status === "unlocked") {
          bundleRef.current = nextBundle;
        } else if (
          rememberedUnlock.status === "invalid" &&
          rememberedUnlock.attemptsRemaining === 0
        ) {
          setError("That PIN isn't correct. No attempts remain.");
          setXChatBrowserSessionState(prospectId, {
            status: "attempts_exhausted",
          });
        } else {
          setXChatBrowserSessionState(prospectId, {
            status: "locked",
            ...(rememberedUnlock.status === "invalid" &&
            typeof rememberedUnlock.attemptsRemaining === "number"
              ? { attemptsRemaining: rememberedUnlock.attemptsRemaining }
              : {}),
          });
        }
      }
    } catch (prepareError) {
      const message = "We couldn't check X/Twitter Chat messages. Try again.";
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
        setXChatBrowserSessionState(
          prospectId,
          response.reason === "xchat_access_denied"
            ? { status: "configuration_required" }
            : { status: "dm_restricted", reason: response.reason }
        );
        return;
      }
      const nextBundle = response;
      await decryptBundle(nextBundle, completedPin);
      if (rememberOnDevice) {
        await rememberSuccessfulXChatPin({
          bundle: nextBundle,
          pin: completedPin,
        });
      }
    } catch (unlockError) {
      setPin("");
      const message = getXChatUnlockErrorMessage(unlockError);
      setXChatBrowserSessionState(
        prospectId,
        getXChatRateLimitState(unlockError) ??
          getXChatUnlockFailureState(unlockError)
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
    const sharedPayload = buildXChatAgentSharePayload(messages);
    const coverageComplete =
      !browserSession.hasMore &&
      messages.length <= MAX_SHARED_XCHAT_MESSAGES &&
      decryptionErrorCount === 0;
    try {
      const prompt = `Analyze the X/Twitter Chat conversation I unlocked with ${evidence.prospectName}. Summarize what happened and assess whether my responses were appropriate in context.`;
      const saved = await initiateAnalysis({
        threadId,
        prospectId: prospectId as Id<"prospects">,
        prompt,
      });
      bundleRef.current = null;
      setOpen(false);
      void streamAnalysis({
        threadId,
        promptMessageId: saved.messageId,
        context: {
          prospectId: prospectId as Id<"prospects">,
          conversationId: browserSession.conversationId,
          decryptedAt: getCurrentUTCTimestamp(),
          coverageComplete,
          excludedAttachmentCount: sharedPayload.excludedAttachmentCount,
          messages: sharedPayload.messages,
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
  const gateMode = getXChatUnlockGateMode(sessionState.status);
  const isPreparingUnlock =
    !browserSession && (isUnlocking || gateMode === "loading");
  const shouldRequestPin =
    !browserSession && !isPreparingUnlock && gateMode === "pin";
  const isXChatAccessDenied = gateMode === "configuration_required";
  const isDmRestricted = gateMode === "dm_restricted";
  const verificationRequired =
    sessionState.status === "dm_restricted" &&
    sessionState.reason === "subscription_required";
  const attemptsExhausted = gateMode === "attempts_exhausted";
  const unlockFailed = !browserSession && gateMode === "error";
  const unlockErrorMessage =
    sessionState.status === "rate_limited"
      ? "X/Twitter is limiting requests. Try again shortly."
      : error || "Try again.";
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
          Share X/Twitter Chat messages
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
              {isPreparingUnlock
                ? "Unlocking X/Twitter Chat"
                : shouldRequestPin
                  ? "Enter your X/Twitter Chat PIN"
                  : isXChatAccessDenied
                    ? "Reconnect X/Twitter"
                    : isDmRestricted
                      ? verificationRequired
                        ? "Verification required"
                        : `Can't message ${evidence.prospectName}`
                      : hasReadableMessages
                        ? "Share unlocked messages"
                        : "X/Twitter Chat unlocked"}
            </DialogTitle>
            <DialogDescription
              id="xchat-pin-privacy"
              className={
                isPreparingUnlock || shouldRequestPin
                  ? "sr-only"
                  : "text-pretty"
              }
            >
              {isPreparingUnlock
                ? "Recovering your encrypted X/Twitter Chat messages."
                : shouldRequestPin
                  ? "Enter your four-digit X/Twitter Chat PIN."
                  : isXChatAccessDenied
                    ? "Reconnect your account to restore Chat access."
                    : isDmRestricted
                      ? verificationRequired
                        ? `${evidence.prospectName} only accepts DMs from verified accounts.`
                        : `${evidence.prospectName} isn't accepting DMs from the connected account.`
                      : hasReadableMessages
                        ? `Share up to the latest ${MAX_SHARED_XCHAT_MESSAGES} messages with the Agent for this response.`
                        : "The messages already visible in the thread remain available. This unlock did not add any additional X/Twitter Chat rows to share for this response."}
            </DialogDescription>
          </DialogHeader>

          {isDmRestricted ? (
            <p className="text-muted-foreground text-sm text-pretty">
              {verificationRequired
                ? "Verify the connected account or use another account."
                : "Use another account or wait for a follow-back."}
            </p>
          ) : isXChatAccessDenied ? (
            <DialogFooter>
              <Button asChild size="xs">
                <Link href="/settings/connected-accounts">
                  Connected accounts
                </Link>
              </Button>
            </DialogFooter>
          ) : attemptsExhausted ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Reset your PIN in X/Twitter Chat.
              </p>
              <DialogFooter>
                <Button asChild size="xs">
                  <a href={XCHAT_HELP_URL} target="_blank" rel="noreferrer">
                    View X/Twitter Chat help
                  </a>
                </Button>
              </DialogFooter>
            </div>
          ) : isPreparingUnlock ? (
            <div
              className="flex min-h-24 items-center justify-center"
              role="status"
              aria-label="Unlocking X/Twitter Chat messages"
            >
              <Spinner variant="circle" className="size-5" />
            </div>
          ) : unlockFailed ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm" role="alert">
                {unlockErrorMessage}
              </p>
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
                  disabled={isCoolingDown}
                  onClick={() => void handleOpen()}
                >
                  Retry
                </Button>
              </DialogFooter>
            </div>
          ) : shouldRequestPin ? (
            <form
              className="space-y-3"
              aria-busy={isUnlocking}
              onSubmit={(event) => {
                event.preventDefault();
                void handleUnlock(pin);
              }}
            >
              <label htmlFor="xchat-agent-pin" className="sr-only">
                X/Twitter Chat PIN
              </label>
              <div className="mx-auto h-11 w-44">
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
                  <InputOTPGroup>
                    {Array.from({ length: XCHAT_PIN_LENGTH }, (_, index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <XChatRememberPinOption
                className="mx-auto"
                rememberOnDevice={rememberOnDevice}
                onRememberOnDeviceChange={setRememberOnDevice}
              />
              <XChatPinRecoveryActions
                className="border-border border-t pt-2"
                onClearSavedPins={() => {
                  setRememberOnDevice(false);
                  return forgetAllRememberedXChatPins().then(() => {
                    toast.success("Saved X/Twitter Chat PINs removed");
                  });
                }}
              />
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
          ) : browserSession && !hasReadableMessages ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm" role="status">
                The conversation is already visible above. This unlock only adds
                encrypted X/Twitter Chat rows when they are available.
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
          ) : browserSession ? (
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
                {XCHAT_AGENT_MEDIA_LIMITATION_COPY}
              </p>
              <p className="text-muted-foreground text-xs leading-5">
                Shared message text goes to the model for this response.
                ReacherX does not keep that plaintext.
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
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
