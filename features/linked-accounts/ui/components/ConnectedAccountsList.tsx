"use client";

import React from "react";
import { Button } from "@/shared/ui/components/Button";
import { formatConnectedRelativeLabel } from "@/features/linked-accounts/lib/connectedRelativeLabel";
import {
  LinkedAccountRow,
  LinkedAccountsListSkeleton,
} from "./LinkedAccountRow";
import type { TwitterConnectionStatus } from "@/features/linked-accounts/hooks/useXAccountConnection";

export interface ConnectedAccountsListProps {
  loading: boolean;
  googleEmail: string;
  googleConnectedAt?: Date;
  isGoogleConnected: boolean;
  xStatus: TwitterConnectionStatus | null;
  onConnectX: () => void;
  onDisconnectX: () => void;
  /** When true, omit Disconnect (e.g. onboarding). */
  hideXDisconnect?: boolean;
}

export function ConnectedAccountsList({
  loading,
  googleEmail,
  googleConnectedAt,
  isGoogleConnected,
  xStatus,
  onConnectX,
  onDisconnectX,
  hideXDisconnect,
}: ConnectedAccountsListProps) {
  if (loading) {
    return <LinkedAccountsListSkeleton rows={3} />;
  }

  const xHandle = xStatus?.isConnected
    ? `@${xStatus.screenName || "connected"}`
    : "@Connect";

  const xIsFullyConnected = Boolean(xStatus?.isConnected);
  const xNeedsReconnect =
    Boolean(xStatus) &&
    !xIsFullyConnected &&
    (xStatus!.status === "reconnect_required" ||
      (xStatus!.missingScopes?.length ?? 0) > 0);

  return (
    <ul className="flex w-full min-w-0 flex-col p-0" role="list">
      <li className="list-none">
        <LinkedAccountRow
          provider="google"
          accountHandle={googleEmail}
          renderRight={() =>
            isGoogleConnected ? (
              <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                {formatConnectedRelativeLabel(googleConnectedAt)}
              </span>
            ) : (
              <span className="text-muted-foreground shrink-0 text-xs">
                Not connected
              </span>
            )
          }
        />
      </li>
      <li className="list-none">
        <LinkedAccountRow
          provider="twitter"
          accountHandle={xHandle}
          renderRight={() => {
            if (xIsFullyConnected) {
              const xConnectedAt =
                xStatus?.connectedAt != null
                  ? new Date(xStatus.connectedAt)
                  : undefined;
              return (
                <>
                  <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                    {formatConnectedRelativeLabel(xConnectedAt)}
                  </span>
                  {!hideXDisconnect ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="shrink-0"
                      onClick={onDisconnectX}
                    >
                      Disconnect
                    </Button>
                  ) : null}
                </>
              );
            }
            if (xNeedsReconnect) {
              return (
                <>
                  {xStatus?.missingScopes &&
                  xStatus.missingScopes.length > 0 ? (
                    <span className="text-muted-foreground hidden max-w-40 truncate text-xs sm:inline">
                      Reconnect required
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="shrink-0"
                    onClick={onConnectX}
                  >
                    Reconnect
                  </Button>
                </>
              );
            }
            return (
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="shrink-0"
                onClick={onConnectX}
              >
                Connect
              </Button>
            );
          }}
        />
      </li>
      <li className="list-none">
        <LinkedAccountRow
          provider="linkedin"
          accountHandle="@Connect"
          renderRight={() => (
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="shrink-0"
              disabled
            >
              Connect
            </Button>
          )}
        />
      </li>
    </ul>
  );
}

export function ConnectedAccountsListWithErrorHint({
  statusError,
  children,
}: {
  statusError: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {children}
      {statusError ? (
        <p className="text-muted-foreground text-xs" role="status">
          {statusError}
        </p>
      ) : null}
    </div>
  );
}
