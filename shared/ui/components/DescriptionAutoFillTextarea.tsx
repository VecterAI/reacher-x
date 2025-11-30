"use client";

import * as React from "react";
import { Textarea } from "@/shared/ui/components/TextArea";
import { cn } from "@/shared/lib/utils/utils";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button } from "@/shared/ui/components/Button";
import { CharacterCounter } from "@/shared/ui/components/CharacterCounter";
import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils/validation";
import { getDescriptionHelpText } from "@/shared/lib/descriptionHelp";
import { useUrlDescription } from "@/shared/hooks/useUrlDescription";
import { getUrlFromWholeValue } from "@/shared/lib/urls/urlParsing";

export type DescriptionAutoFillTextareaProps = {
  value: string;
  onValueChange: (newValue: string) => void;
  setText: (
    text: string,
    opts?: { validate?: boolean; dirty?: boolean }
  ) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showCharacterCounter?: boolean;
  onSourceUrlChange?: (url: string | null) => void;
  onReadingChange?: (reading: boolean) => void;
  rightActions?: React.ReactNode; // optional slot for actions on the right (e.g., Continue)
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const DescriptionAutoFillTextarea = React.forwardRef<
  HTMLTextAreaElement,
  DescriptionAutoFillTextareaProps
>(
  (
    {
      value,
      onValueChange,
      setText,
      disabled,
      placeholder = "Enter product, service, or portfolio link to auto-fill or fill manually...",
      className,
      showCharacterCounter = true,
      onSourceUrlChange,
      onReadingChange,
      rightActions,
      ...rest
    },
    ref
  ) => {
    const charCount = value.length;
    const MAX_CHARS = DESCRIPTION_CONSTRAINTS.MAX_LENGTH;
    const helpText = getDescriptionHelpText(charCount);

    const {
      isReadingUrl,
      readError,
      scheduleReadIfValid,
      beginRead,
      cancelRead,
    } = useUrlDescription({
      setText,
      onSourceUrlChange,
      onReadingChange,
    });

    return (
      <>
        {readError && (
          <Alert className="mb-2">
            <AlertTitle>Couldn&apos;t read the URL</AlertTitle>
            <AlertDescription>
              {readError} You can paste another URL. You can also write a manual
              description.
            </AlertDescription>
          </Alert>
        )}
        <Textarea
          ref={ref}
          placeholder={placeholder}
          className={cn(
            "max-h-fit min-h-[120px] resize-y",
            charCount > MAX_CHARS && "border-destructive",
            className
          )}
          value={value}
          readOnly={isReadingUrl}
          disabled={disabled || isReadingUrl}
          {...rest}
          onChange={(e) => {
            if (isReadingUrl) return;
            const val = e.target.value;
            onValueChange(val);
            scheduleReadIfValid(val);
          }}
          onPaste={(e) => {
            if (isReadingUrl) return;
            const pasted = e.clipboardData.getData("text");
            // Only trigger if the entire pasted content is a valid full URL
            const candidate = getUrlFromWholeValue(pasted);
            if (candidate) {
              onValueChange(pasted);
              e.preventDefault();
              void beginRead(candidate);
            }
          }}
          onBlur={(e) => {
            if (isReadingUrl) return;
            const val = e.target.value;
            // Trigger an immediate read if value is a whole URL
            const candidate = getUrlFromWholeValue(val);
            if (candidate) {
              void beginRead(candidate);
            }
          }}
          onKeyDown={(e) => {
            if (isReadingUrl) return;
            const target = e.currentTarget as HTMLTextAreaElement;
            // Begin read immediately on Enter (no Shift)
            if (e.key === "Enter" && !e.shiftKey) {
              const candidate = getUrlFromWholeValue(target.value);
              if (candidate) {
                e.preventDefault();
                void beginRead(candidate);
                return;
              }
            }
          }}
          maxLength={MAX_CHARS + 50}
          aria-required="true"
        />

        <div
          className={cn(
            "text-sm transition-colors",
            helpText.variant === "error"
              ? "text-red-500 focus-visible:ring-red-500"
              : helpText.variant === "warning"
                ? "text-primary dark:text-primary"
                : "text-muted-foreground"
          )}
        >
          {isReadingUrl ? (
            <AsciiSpinnerText text="Auto-filling description from your link..." />
          ) : (
            helpText.text
          )}
        </div>

        <div className="flex items-center justify-between">
          {showCharacterCounter ? (
            <CharacterCounter current={charCount} max={MAX_CHARS} />
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {isReadingUrl && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={cancelRead}
              >
                Cancel
              </Button>
            )}
            {rightActions}
          </div>
        </div>
      </>
    );
  }
);

DescriptionAutoFillTextarea.displayName = "DescriptionAutoFillTextarea";

export default DescriptionAutoFillTextarea;
