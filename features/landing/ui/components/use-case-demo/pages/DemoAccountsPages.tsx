/**
 * DemoConnectedAccountsPage
 * Faithful replica of app/(webapp)/settings/connected-accounts/page.tsx
 * with static connection statuses. Reuses the real ConnectedAccountsList
 * (prop-driven). Omitted vs real: LinkedInConnectNoticeDialog (connect
 * flow is wired), live mutating indicator.
 */
"use client";

import * as React from "react";
import {
  ConnectedAccountsList,
  ConnectedAccountsListWithErrorHint,
} from "@/features/linked-accounts/ui/components";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";

export function DemoConnectedAccountsPage() {
  return (
    <PageLayout className="flex max-w-none flex-col overflow-hidden border-none">
      <PageHeader title="Connected accounts" />
      <div className="scroll-fade min-h-0 flex-1 overflow-y-auto">
        <PageContent className="mx-4 mt-4 w-full max-w-lg pb-4">
          <ConnectedAccountsListWithErrorHint statusError={null}>
            <ConnectedAccountsList
              loading={false}
              googleEmail="demo@reacherx.com"
              isGoogleConnected
              xStatus={{
                isConnected: true,
                status: "connected",
                screenName: "demo_founder",
                name: "Demo User",
              }}
              linkedinStatus={{
                isConnected: true,
                status: "connected",
                publicIdentifier: "demouser",
                displayName: "Demo User",
              }}
              onConnectX={() => {}}
              onDisconnectX={() => {}}
              onConnectLinkedIn={() => {}}
              onDisconnectLinkedIn={() => {}}
            />
          </ConnectedAccountsListWithErrorHint>
        </PageContent>
      </div>
    </PageLayout>
  );
}
