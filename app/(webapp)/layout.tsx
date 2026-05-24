// app/(webapp)/layout.tsx
import type { Metadata } from "next";
import { ReactNode, Suspense } from "react";
import {
  NotificationProvider,
  OnboardingLockGuardProvider,
  WebAppChromeScaffold,
  WebAppLoadingContentSkeleton,
} from "@/features/webapp/ui/components";
import { ProfileProvider } from "@/features/profile/contexts/TwitterProfileContext";
import { ProspectProfileProvider } from "@/features/prospects/contexts";
import { WorkspaceTransitionProvider } from "@/features/webapp/contexts/WorkspaceTransitionContext";
import { ActiveUseCaseLabelsProvider } from "@/shared/contexts/ActiveUseCaseLabelsProvider";
import { APP_DESCRIPTION } from "@/shared/lib/metadata";
import { DEFAULT_SIDEBAR_OPEN } from "@/shared/lib/sidebarState";

export const metadata: Metadata = {
  title: "ReacherX",
  description: APP_DESCRIPTION,
};

function WebAppLayoutFrame({
  children,
}: {
  children: ReactNode;
}) {
  const shellFallback = (
    <WebAppChromeScaffold
      initialSidebarOpen={DEFAULT_SIDEBAR_OPEN}
      mode="loading"
    >
      <WebAppLoadingContentSkeleton />
    </WebAppChromeScaffold>
  );

  return (
    <Suspense fallback={shellFallback}>
      <ActiveUseCaseLabelsProvider initialUseCaseKey={null}>
        <ProfileProvider>
          <ProspectProfileProvider>
            <WorkspaceTransitionProvider>
              <NotificationProvider>
                <OnboardingLockGuardProvider>
                  <WebAppChromeScaffold
                    initialSidebarOpen={DEFAULT_SIDEBAR_OPEN}
                    mode="live"
                  >
                    <Suspense fallback={<WebAppLoadingContentSkeleton />}>
                      {children}
                    </Suspense>
                  </WebAppChromeScaffold>
                </OnboardingLockGuardProvider>
              </NotificationProvider>
            </WorkspaceTransitionProvider>
          </ProspectProfileProvider>
        </ProfileProvider>
      </ActiveUseCaseLabelsProvider>
    </Suspense>
  );
}

export default function WebAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <WebAppLayoutFrame>{children}</WebAppLayoutFrame>;
}
