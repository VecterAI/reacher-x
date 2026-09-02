"use client";

import type { XDmEligibility } from "@/shared/lib/twitter/dm";
import { highlightTextMultiple } from "@/shared/lib/utils";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button } from "@/shared/ui/components/Button";
import { WarningIcon } from "@/shared/ui/components/icons";

export function XDmEligibilityAlert({
  eligibility,
  onManageAccount,
}: {
  eligibility: XDmEligibility;
  onManageAccount: () => void;
}) {
  const copyTokens = Array.from(
    new Set(
      [
        eligibility.recipientLabel,
        eligibility.recipientUsername,
        eligibility.senderUsername,
      ].filter((value): value is string => Boolean(value?.trim()))
    )
  );
  const highlightOptions = {
    highlightClassName:
      "bg-transparent font-mono text-muted-foreground font-normal",
    includeAria: false,
  } as const;
  const description = highlightTextMultiple(
    eligibility.reasonLabel,
    copyTokens,
    highlightOptions
  ).highlightedText;
  const needsAccountAction =
    eligibility.reasonCode === "missing_connection" ||
    eligibility.reasonCode === "missing_scopes";

  return (
    <Alert className="mt-2">
      <WarningIcon className="size-4 fill-current" aria-hidden />
      <AlertTitle className="text-sm leading-5 text-balance">
        {eligibility.reasonTitle ?? "DM unavailable"}
      </AlertTitle>
      <AlertDescription className="space-y-3 text-pretty">
        <p>{description}</p>
        {needsAccountAction ? (
          <div>
            <Button size="xs" onClick={onManageAccount}>
              {eligibility.reasonCode === "missing_scopes"
                ? "Reconnect account"
                : "Connect account"}
            </Button>
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
