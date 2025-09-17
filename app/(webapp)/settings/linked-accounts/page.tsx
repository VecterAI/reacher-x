"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";
import { useLinkedAccounts } from "@/features/webapp/hooks/useLinkedAccounts";
import { Card, CardContent } from "@/shared/ui/components/Card";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { TwitterIcon, GoogleIcon } from "@/shared/ui/components/icons";
import { formatRelativeTime } from "@/shared/lib/utils/format";

// Account Card Component - inline following codebase patterns
interface AccountCardProps {
  provider: "twitter" | "google";
  accountName: string;
  accountHandle: string;
  isConnected: boolean;
  connectedAt?: Date;
  onReconnect?: () => void;
  onDisconnect?: () => void;
}

function AccountCard({
  provider,
  accountHandle,
  isConnected,
  connectedAt,
  onReconnect,
  onDisconnect,
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
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-muted p-2">{getProviderIcon()}</div>
            <div className="flex min-w-0 flex-col">
              <h3 className="truncate text-sm font-medium text-foreground">
                {getProviderDisplayName()}
              </h3>
              <p className="truncate font-mono text-sm text-muted-foreground">
                {accountHandle}
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  · {getConnectionStatus()}
                </span>
                <Button variant="outline" size="xs" onClick={onDisconnect}>
                  Disconnect
                </Button>
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

// Account Card Skeleton - inline following codebase patterns
function AccountCardSkeleton() {
  return (
    <Card className="border-none shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0">
              <Skeleton className="size-8 rounded-md" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LinkedAccountsPage() {
  const router = useRouter();
  const { accounts, isLoading, reconnectAccount } = useLinkedAccounts();

  const handleDisconnect = (accountId: string) => {
    // TODO: Implement disconnect logic
    console.log("Disconnecting account:", accountId);
  };

  return (
    <PageLayout>
      <PageHeader title="Linked accounts" onBack={() => router.back()} />
      <PageContent className="mx-4 mt-4">
        <div className="space-y-4">
          {/* Loading state */}
          {isLoading && (
            <>
              <AccountCardSkeleton />
              <AccountCardSkeleton />
            </>
          )}

          {/* Account cards */}
          {!isLoading && accounts.length > 0 && (
            <div className="space-y-4">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  provider={account.provider}
                  accountName={account.accountName}
                  accountHandle={account.accountHandle}
                  isConnected={account.isConnected}
                  connectedAt={account.connectedAt}
                  onReconnect={() => reconnectAccount(account.id)}
                  onDisconnect={() => handleDisconnect(account.id)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && accounts.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                No linked accounts found. Connect your social media accounts to
                get started.
              </p>
            </div>
          )}
        </div>
      </PageContent>
    </PageLayout>
  );
}
