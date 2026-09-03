"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/components/Button";
import { Checkbox } from "@/shared/ui/components/Checkbox";
import { cn } from "@/shared/lib/utils";
import { hasRememberedXChatPins } from "@/features/agent/lib/xChatDeviceCredentialStorage";

export const XCHAT_HELP_URL = "https://help.x.com/en/using-x/about-chat";

export function XChatRememberPinOption({
  rememberOnDevice,
  onRememberOnDeviceChange,
  className,
}: {
  rememberOnDevice: boolean;
  onRememberOnDeviceChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "text-muted-foreground inline-flex cursor-pointer items-center gap-2 text-sm",
        className
      )}
    >
      <Checkbox
        checked={rememberOnDevice}
        onCheckedChange={(checked) =>
          onRememberOnDeviceChange(checked === true)
        }
        aria-label="Remember X/Twitter Chat PIN until logout"
      />
      <span>Remember until I log out</span>
    </label>
  );
}

export function XChatPinRecoveryActions({
  onClearSavedPins,
  className,
}: {
  onClearSavedPins: () => void | Promise<void>;
  className?: string;
}) {
  const [hasSavedPins, setHasSavedPins] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    let isActive = true;
    void hasRememberedXChatPins().then((hasPins) => {
      if (isActive) setHasSavedPins(hasPins);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const handleClearSavedPins = async () => {
    setIsClearing(true);
    try {
      await onClearSavedPins();
      setHasSavedPins(await hasRememberedXChatPins());
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 text-sm",
        className
      )}
    >
      <Button asChild variant="link" size="xs">
        <a href={XCHAT_HELP_URL} target="_blank" rel="noreferrer">
          Forgot PIN?
        </a>
      </Button>
      {hasSavedPins ? (
        <>
          <span className="bg-border h-4 w-px" aria-hidden />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={isClearing}
            onClick={() => void handleClearSavedPins()}
          >
            Clear saved PINs
          </Button>
        </>
      ) : null}
    </div>
  );
}
