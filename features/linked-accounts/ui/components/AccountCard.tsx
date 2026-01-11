"use client";

import React from "react";
import { Card, CardContent } from "@/shared/ui/components/Card";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { TwitterIcon, GoogleIcon } from "@/shared/ui/components/icons";
import { formatRelativeTime } from "@/shared/lib/utils";

export interface AccountCardProps {
  provider: "twitter" | "google";
  accountName: string;
  accountHandle: string;
  isConnected: boolean;
  connectedAt?: Date;
  onReconnect?: () => void;
  onDisconnect?: () => void;
  statusText?: string;
}

export function AccountCard({
  provider,
  accountHandle,
  isConnected,
  connectedAt,
  onReconnect,
  onDisconnect,
  statusText,
}: AccountCardProps) {
  const getProviderIcon = () => {
    switch (provider) {
      case "twitter":
        return <TwitterIcon className="h-5 w-5" />;
      case "google":
        return <GoogleIcon className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getProviderDisplayName = () => {
    switch (provider) {
      case "twitter":
        return "Twitter";
      case "google":
        return "Google";
      default:
        return provider;
    }
  };

  const getConnectionStatus = () => {
    if (isConnected && connectedAt) {
      return formatRelativeTime(connectedAt.toISOString());
    }
    return "Not connected";
  };

  return (
    <Card className="border-none shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="bg-muted rounded-md p-2">{getProviderIcon()}</div>
            <div className="flex min-w-0 flex-col">
              <h3 className="text-foreground truncate text-sm font-medium">
                {getProviderDisplayName()}
              </h3>
              <p className="text-muted-foreground truncate font-mono text-sm">
                {accountHandle}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  · {statusText ? statusText : getConnectionStatus()}
                </span>
                {provider === "twitter" && (
                  <Button variant="outline" size="xs" onClick={onDisconnect}>
                    Disconnect
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="xs" onClick={onReconnect}>
                  Connect
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountCardSkeleton() {
  return (
    <Card className="border-none shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="shrink-0">
              <Skeleton className="size-8 rounded-md" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
