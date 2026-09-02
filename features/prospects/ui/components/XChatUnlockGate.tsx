"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import Link from "next/link";
import { useId } from "react";
import { Button } from "@/shared/ui/components/Button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/shared/ui/components/InputOTP";
import { Spinner } from "@/shared/ui/components/Spinner";
import { XChatIcon } from "@/shared/ui/components/icons";
import { cn } from "@/shared/lib/utils";
import type { XChatBrowserSessionState } from "@/features/agent/lib/xChatBrowserSession";
import {
  XChatPinRecoveryActions,
  XChatRememberPinOption,
  XCHAT_HELP_URL,
} from "@/features/agent/ui/components/XChatPinPreferences";
import { getXChatUnlockGateMode } from "@/features/prospects/lib/xChatUnlockGate";

const XCHAT_PIN_LENGTH = 4;
export function XChatUnlockGate({
  sessionState,
  recipientName,
  recipientUsername,
  senderUsername,
  pin,
  errorMessage,
  isBusy,
  isCoolingDown,
  pinInputId,
  errorDescriptionId,
  onPinChange,
  onPinComplete,
  rememberOnDevice,
  onRememberOnDeviceChange,
  onForgetRememberedPins,
  onRetry,
  className,
}: {
  sessionState: XChatBrowserSessionState;
  recipientName?: string;
  recipientUsername?: string;
  senderUsername?: string;
  pin: string;
  errorMessage: string | null;
  isBusy: boolean;
  isCoolingDown: boolean;
  pinInputId: string;
  errorDescriptionId: string;
  onPinChange: (value: string) => void;
  onPinComplete: (pin: string) => void;
  rememberOnDevice: boolean;
  onRememberOnDeviceChange: (checked: boolean) => void;
  onForgetRememberedPins: () => void;
  onRetry: () => void;
  className?: string;
}) {
  const titleId = useId();
  const gateMode = getXChatUnlockGateMode(sessionState.status);
  const shouldRequestPin = gateMode === "pin";
  const isXChatAccessDenied = gateMode === "configuration_required";
  const isDmRestricted = gateMode === "dm_restricted";
  const attemptsExhausted = gateMode === "attempts_exhausted";
  const recipientLabel =
    recipientName?.trim() ||
    (recipientUsername ? `@${recipientUsername.replace(/^@/u, "")}` : null) ||
    "this person";
  const senderLabel = senderUsername
    ? `@${senderUsername.replace(/^@/u, "")}`
    : "your connected account";
  const verificationRequired =
    sessionState.status === "dm_restricted" &&
    sessionState.reason === "subscription_required";

  if (gateMode === "loading") {
    return (
      <div
        role="status"
        aria-label={
          sessionState.status === "unlocking"
            ? "Unlocking X/Twitter Chat messages"
            : "Loading X/Twitter conversation"
        }
        className={cn(
          "flex min-h-48 flex-1 items-center justify-center",
          className
        )}
      >
        <Spinner variant="circle" className="size-5" />
      </div>
    );
  }

  if (gateMode === "hidden") {
    return null;
  }

  return (
    <section
      className={cn(
        "relative flex min-h-0 flex-1 items-center justify-center px-5 py-8 sm:px-8",
        shouldRequestPin && "pb-20",
        className
      )}
      aria-labelledby={titleId}
    >
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <XChatIcon
          className={cn("mb-4", shouldRequestPin ? "size-16" : "size-12")}
          aria-hidden
        />
        <h2
          id={titleId}
          className={cn(
            shouldRequestPin
              ? "text-foreground text-center text-xl font-medium text-balance sm:text-2xl"
              : "text-base font-medium text-balance"
          )}
        >
          {shouldRequestPin
            ? "Enter your X/Twitter Chat PIN"
            : isXChatAccessDenied
              ? "Reconnect X/Twitter"
              : isDmRestricted
                ? verificationRequired
                  ? "Verification required"
                  : `Can't message ${recipientLabel}`
                : attemptsExhausted
                  ? "No PIN attempts left"
                  : "Couldn't check X/Twitter Chat"}
        </h2>
        {!shouldRequestPin &&
        (isXChatAccessDenied || isDmRestricted || attemptsExhausted) ? (
          <p className="text-muted-foreground mt-1.5 max-w-64 text-sm leading-5 text-pretty">
            {isXChatAccessDenied
              ? "Reconnect your X/Twitter account to restore Chat access."
              : isDmRestricted
                ? verificationRequired
                  ? `${recipientLabel} only accepts DMs from verified accounts. Verify ${senderLabel} or use another account.`
                  : `${recipientLabel} isn't accepting DMs from ${senderLabel}. Use another account or wait for a follow-back.`
                : attemptsExhausted
                  ? "Reset your PIN in X/Twitter Chat."
                  : null}
          </p>
        ) : null}

        {shouldRequestPin ? (
          <form
            className="mt-5 flex w-full flex-col items-center"
            aria-busy={isBusy}
            onSubmit={(event) => {
              event.preventDefault();
              onPinComplete(pin);
            }}
          >
            <label htmlFor={pinInputId} className="sr-only">
              X/Twitter Chat PIN
            </label>
            <div className="h-11 w-44">
              <InputOTP
                id={pinInputId}
                value={pin}
                onChange={onPinChange}
                onComplete={onPinComplete}
                maxLength={XCHAT_PIN_LENGTH}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                disabled={isBusy || isCoolingDown}
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? errorDescriptionId : undefined}
                containerClassName="justify-center has-disabled:opacity-100"
              >
                <InputOTPGroup>
                  {Array.from({ length: XCHAT_PIN_LENGTH }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {errorMessage ? (
              <div
                id={errorDescriptionId}
                className="mt-3 text-sm"
                aria-live="polite"
              >
                <p className="text-destructive" role="alert">
                  {errorMessage}
                </p>
              </div>
            ) : null}
            <XChatRememberPinOption
              className="mt-4"
              rememberOnDevice={rememberOnDevice}
              onRememberOnDeviceChange={onRememberOnDeviceChange}
            />
          </form>
        ) : isXChatAccessDenied ? (
          <Button asChild type="button" size="sm" className="mt-5">
            <Link href="/settings/connected-accounts">Connected accounts</Link>
          </Button>
        ) : isDmRestricted ? null : attemptsExhausted ? (
          <Button asChild type="button" size="sm" className="mt-5">
            <a href={XCHAT_HELP_URL} target="_blank" rel="noreferrer">
              View X/Twitter Chat help
            </a>
          </Button>
        ) : errorMessage ? (
          <div className="mt-5 flex flex-col items-center">
            {errorMessage ? (
              <p
                className="text-muted-foreground max-w-64 text-sm text-pretty"
                role="alert"
              >
                {sessionState.status === "rate_limited"
                  ? "X/Twitter is limiting requests. Try again shortly."
                  : errorMessage}
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              disabled={isBusy || isCoolingDown}
              onClick={onRetry}
            >
              {isCoolingDown ? "Please wait" : "Retry"}
            </Button>
          </div>
        ) : null}
      </div>
      {shouldRequestPin ? (
        <XChatPinRecoveryActions
          className="absolute inset-x-0 bottom-0 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onClearSavedPins={onForgetRememberedPins}
        />
      ) : null}
    </section>
  );
}
