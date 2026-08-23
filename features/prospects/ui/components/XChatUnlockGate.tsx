"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import Link from "next/link";
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

const XCHAT_PIN_LENGTH = 4;

export function XChatUnlockGate({
  sessionState,
  pin,
  errorMessage,
  isBusy,
  isCoolingDown,
  pinInputId,
  errorDescriptionId,
  onPinChange,
  onPinComplete,
  onRetry,
  className,
}: {
  sessionState: XChatBrowserSessionState;
  pin: string;
  errorMessage: string | null;
  isBusy: boolean;
  isCoolingDown: boolean;
  pinInputId: string;
  errorDescriptionId: string;
  onPinChange: (value: string) => void;
  onPinComplete: (pin: string) => void;
  onRetry: () => void;
  className?: string;
}) {
  const isChecking =
    sessionState.status === "unknown" || sessionState.status === "checking";
  const shouldRequestPin =
    sessionState.status === "locked" || sessionState.status === "unlocking";
  const isXChatAccessDenied = sessionState.status === "configuration_required";

  if (isChecking) {
    return (
      <div
        role="status"
        aria-label="Loading X/Twitter conversation"
        className={cn(
          "flex min-h-48 flex-1 items-center justify-center",
          className
        )}
      >
        <Spinner variant="circle" className="size-5" />
      </div>
    );
  }

  return (
    <section
      className={cn(
        "flex min-h-0 flex-1 items-center justify-center px-5 py-8 sm:px-8",
        className
      )}
      aria-labelledby="xchat-unlock-title"
    >
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <XChatIcon className="mb-4 size-16" aria-hidden />
        <h2
          id="xchat-unlock-title"
      className={cn(
        shouldRequestPin
          ? "text-foreground text-center text-xl font-medium text-pretty sm:text-2xl"
          : "text-base font-medium"
      )}
        >
          {shouldRequestPin
            ? "Enter your XChat PIN"
            : isXChatAccessDenied
              ? "XChat API access unavailable"
              : "Couldn't check XChat messages"}
        </h2>
        {!shouldRequestPin ? (
          <p className="text-muted-foreground mt-1.5 text-sm leading-5">
            {isXChatAccessDenied
              ? "X accepted the connected account but denied this app access to encrypted XChat endpoints. Reconnect X once; if this remains, contact X Developer support."
              : "Retry the encrypted-message check."}
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
              XChat PIN
            </label>
            <div className="relative h-11 w-44">
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
                aria-describedby={errorDescriptionId}
                containerClassName="justify-center has-disabled:opacity-100"
              >
                <InputOTPGroup
                  className={cn(
                    "transition-opacity duration-150",
                    sessionState.status === "unlocking" && "opacity-0"
                  )}
                >
                  {Array.from({ length: XCHAT_PIN_LENGTH }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {sessionState.status === "unlocking" ? (
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
            <div
              id={errorDescriptionId}
              className="mt-3 min-h-5 text-sm"
              aria-live="polite"
            >
              {errorMessage ? (
                <p className="text-destructive" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </form>
        ) : isXChatAccessDenied ? (
          <Button asChild type="button" size="sm" className="mt-5">
            <Link href="/settings/connected-accounts">Connected accounts</Link>
          </Button>
        ) : errorMessage ? (
          <div className="mt-5 flex flex-col items-center">
            {errorMessage ? (
              <p className="text-muted-foreground text-sm" role="alert">
                {sessionState.status === "rate_limited"
                  ? "X is temporarily limiting requests. Try again when the cooldown ends."
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
    </section>
  );
}
