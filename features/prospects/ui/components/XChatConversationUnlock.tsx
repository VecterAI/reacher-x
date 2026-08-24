"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  decryptXChatInBrowser,
  decryptXChatWithRememberedPin,
  getXChatRateLimitState,
  getXChatUnlockErrorMessage,
  getXChatUnlockFailureState,
  hasUnlockedXChatSession,
  rememberSuccessfulXChatPin,
  requestXChatDecryptBundleOnce,
  setXChatBrowserSessionState,
  useXChatBrowserSession,
  useXChatBrowserSessionState,
  useXChatRetryCooldown,
  type XChatDecryptBundle,
  type XChatDecryptBundleResponse,
} from "@/features/agent/lib/xChatBrowserSession";
import { XChatUnlockGate } from "./XChatUnlockGate";
import { forgetAllRememberedXChatPins } from "@/features/agent/lib/xChatDeviceCredentialStorage";

const XCHAT_PIN_LENGTH = 4;

/**
 * Browser-only XChat unlock state. The PIN and decrypted plaintext stay in
 * browser memory; completing the PIN starts the unlock attempt automatically.
 */
export function XChatConversationUnlock({
  prospectId,
  participantUserId,
  className,
}: {
  prospectId: string;
  participantUserId?: string | null;
  className?: string;
}) {
  const getDecryptBundle = useAction(api.x.getXChatDecryptBundle);
  const getEncryptedMedia = useAction(api.x.getXChatEncryptedMedia);
  const getRealmAuthToken = useAction(api.x.getXChatRealmAuthToken);
  const session = useXChatBrowserSession({ prospectId, participantUserId });
  const sessionState = useXChatBrowserSessionState(prospectId);
  const pinInputId = React.useId();
  const errorDescriptionId = React.useId();
  const bundleRef = React.useRef<XChatDecryptBundle | null>(null);
  const unlockInFlightRef = React.useRef(false);
  const [pin, setPin] = React.useState("");
  const [rememberOnDevice, setRememberOnDevice] = React.useState(true);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const isBusy =
    sessionState.status === "checking" || sessionState.status === "unlocking";
  const isCoolingDown = useXChatRetryCooldown(
    sessionState.status === "rate_limited" ? sessionState.retryAt : undefined
  );

  const prepareBundle = React.useCallback(async () => {
    if (isBusy || isCoolingDown) return;
    setLocalError(null);
    setXChatBrowserSessionState(prospectId, { status: "checking" });
    try {
      const response = await requestXChatDecryptBundleOnce(
        prospectId,
        async () =>
          (await getDecryptBundle({
            prospectId: prospectId as Id<"prospects">,
          })) as XChatDecryptBundleResponse
      );
      if (response.availability === "unavailable") {
        bundleRef.current = null;
        setXChatBrowserSessionState(prospectId, { status: "unavailable" });
        return;
      }
      if (response.availability === "blocked") {
        bundleRef.current = null;
        setXChatBrowserSessionState(prospectId, {
          status: "configuration_required",
        });
        return;
      }
      const bundle = response;
      bundleRef.current = bundle;
      if (hasUnlockedXChatSession(bundle)) {
        setXChatBrowserSessionState(prospectId, { status: "unlocking" });
        await decryptXChatInBrowser({
          prospectId,
          bundle,
          pin: "",
          getRealmAuthToken: async (realmId) =>
            await getRealmAuthToken({ realmId }),
          getEncryptedMedia: async (mediaHashKey) =>
            await getEncryptedMedia({
              prospectId: prospectId as Id<"prospects">,
              mediaHashKey,
            }),
        });
        return;
      }
      setXChatBrowserSessionState(prospectId, { status: "unlocking" });
      const rememberedUnlock = await decryptXChatWithRememberedPin({
        prospectId,
        bundle,
        getRealmAuthToken: async (realmId) =>
          await getRealmAuthToken({ realmId }),
        getEncryptedMedia: async (mediaHashKey) =>
          await getEncryptedMedia({
            prospectId: prospectId as Id<"prospects">,
            mediaHashKey,
          }),
      });
      if (rememberedUnlock.status === "unlocked") return;
      if (rememberedUnlock.status === "invalid") {
        const attemptsRemaining = rememberedUnlock.attemptsRemaining;
        if (attemptsRemaining === 0) {
          setLocalError("That PIN isn't correct. No attempts remain.");
          setXChatBrowserSessionState(prospectId, {
            status: "attempts_exhausted",
          });
          return;
        }
        setLocalError(
          typeof attemptsRemaining === "number"
            ? `Your saved PIN is no longer correct. You have ${attemptsRemaining} ${attemptsRemaining === 1 ? "attempt" : "attempts"} left.`
            : "Your saved PIN is no longer correct. Enter it again."
        );
        setXChatBrowserSessionState(prospectId, {
          status: "locked",
          ...(typeof attemptsRemaining === "number"
            ? { attemptsRemaining }
            : {}),
        });
        return;
      }
      setXChatBrowserSessionState(prospectId, { status: "locked" });
    } catch (error) {
      const message = "We couldn't check XChat messages. Try again.";
      setLocalError(message);
      setXChatBrowserSessionState(
        prospectId,
        getXChatRateLimitState(error) ?? { status: "error", message }
      );
    }
  }, [
    getDecryptBundle,
    getEncryptedMedia,
    getRealmAuthToken,
    isBusy,
    isCoolingDown,
    prospectId,
  ]);

  const handleUnlock = React.useCallback(
    async (completedPin: string) => {
      if (
        completedPin.length !== XCHAT_PIN_LENGTH ||
        isBusy ||
        isCoolingDown ||
        unlockInFlightRef.current
      ) {
        return;
      }

      unlockInFlightRef.current = true;
      setLocalError(null);
      setXChatBrowserSessionState(prospectId, { status: "unlocking" });
      try {
        const cachedBundle = bundleRef.current;
        const response = cachedBundle
          ? ({ availability: "available", ...cachedBundle } as const)
          : await requestXChatDecryptBundleOnce(
              prospectId,
              async () =>
                (await getDecryptBundle({
                  prospectId: prospectId as Id<"prospects">,
                })) as XChatDecryptBundleResponse
            );
        if (response.availability === "unavailable") {
          bundleRef.current = null;
          setPin("");
          setXChatBrowserSessionState(prospectId, { status: "unavailable" });
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
        const bundle = response;
        bundleRef.current = bundle;

        setXChatBrowserSessionState(prospectId, { status: "unlocking" });
        const pinToUse = hasUnlockedXChatSession(bundle) ? "" : completedPin;
        await decryptXChatInBrowser({
          prospectId,
          bundle,
          pin: pinToUse,
          getRealmAuthToken: async (realmId) =>
            await getRealmAuthToken({ realmId }),
          getEncryptedMedia: async (mediaHashKey) =>
            await getEncryptedMedia({
              prospectId: prospectId as Id<"prospects">,
              mediaHashKey,
            }),
        });
        if (pinToUse && rememberOnDevice) {
          await rememberSuccessfulXChatPin({ bundle, pin: pinToUse });
        }
        setPin("");
        setLocalError(null);
      } catch (error) {
        setPin("");
        const message = getXChatUnlockErrorMessage(error);
        setLocalError(message);
        setXChatBrowserSessionState(
          prospectId,
          getXChatRateLimitState(error) ?? getXChatUnlockFailureState(error)
        );
      } finally {
        unlockInFlightRef.current = false;
      }
    },
    [
      getDecryptBundle,
      getEncryptedMedia,
      getRealmAuthToken,
      isBusy,
      isCoolingDown,
      prospectId,
      rememberOnDevice,
    ]
  );

  React.useEffect(() => {
    if (sessionState.status !== "unknown" || isBusy || isCoolingDown) return;
    void prepareBundle();
  }, [isBusy, isCoolingDown, prepareBundle, sessionState.status]);

  if (sessionState.status === "unavailable") {
    return null;
  }

  if (sessionState.status === "unlocked" && session) {
    return null;
  }

  const errorMessage =
    localError ??
    (sessionState.status === "error" || sessionState.status === "rate_limited"
      ? sessionState.message
      : null);
  return (
    <XChatUnlockGate
      className={className}
      sessionState={sessionState}
      pin={pin}
      errorMessage={errorMessage}
      isBusy={isBusy}
      isCoolingDown={isCoolingDown}
      pinInputId={pinInputId}
      errorDescriptionId={errorDescriptionId}
      onPinChange={(value) => {
        setPin(value);
        if (localError) setLocalError(null);
      }}
      onPinComplete={(completedPin) => void handleUnlock(completedPin)}
      rememberOnDevice={rememberOnDevice}
      onRememberOnDeviceChange={setRememberOnDevice}
      onForgetRememberedPins={() => {
        setRememberOnDevice(false);
        return forgetAllRememberedXChatPins();
      }}
      onRetry={() => void prepareBundle()}
    />
  );
}
