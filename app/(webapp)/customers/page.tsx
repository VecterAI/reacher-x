"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/shared/ui/components/PageHeader";
import { useAuth } from "@/shared/hooks/useAuth";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";

export default function CustomersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Show loading skeleton until auth state is determined
  if (authLoading) {
    return (
      <PageLayout>
        <PageHeader title="Customers" onBack={() => router.back()} />
        <PageContent className="mx-4 mt-4">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader title="Customers" onBack={() => router.back()} />
      <PageContent className="mx-4 mt-4">
        {/* Authentication message for unauthenticated users */}
        {!isAuthenticated && (
          <Alert className="mb-6">
            <AlertTitle>Account required</AlertTitle>
            <AlertDescription>
              To view and manage your customers, please create an account or log
              in. Your customer data and interactions will be synced to your
              account.
            </AlertDescription>
          </Alert>
        )}

        {/* Content for authenticated users */}
        {isAuthenticated && (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Content goes here - Customer management and analytics will be
              implemented in future updates.
            </p>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
