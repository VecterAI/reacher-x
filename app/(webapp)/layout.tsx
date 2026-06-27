// app/(webapp)/layout.tsx
import type { Metadata } from "next";
import { ReactNode, Suspense } from "react";
import {
  NotificationProvider,
  OnboardingLockGuardProvider,
  WebAppChromeScaffold,
  WebAppLoadingContentSkeleton,
} from "@/features/webapp/ui/components";
import { ActiveUseCaseLabelsBoundary } from "@/features/webapp/ui/components/ActiveUseCaseLabelsBoundary";
import { ProfileProvider } from "@/features/profile/contexts/TwitterProfileContext";
import { ProspectProfileProvider } from "@/features/prospects/contexts";
import { WorkspaceTransitionProvider } from "@/features/webapp/contexts/WorkspaceTransitionContext";
import { APP_DESCRIPTION } from "@/shared/lib/metadata";

export const metadata: Metadata = {
  title: "ReacherX",
  description: APP_DESCRIPTION,
};

export default function WebAppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ActiveUseCaseLabelsBoundary>
        <WebAppLayoutContent>{children}</WebAppLayoutContent>
      </ActiveUseCaseLabelsBoundary>
    </Suspense>
  );
}

function WebAppLayoutContent({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <ProspectProfileProvider>
        <WorkspaceTransitionProvider>
          <NotificationProvider>
            <Suspense fallback={null}>
              <OnboardingLockGuardProvider>{null}</OnboardingLockGuardProvider>
            </Suspense>
            <WebAppChromeScaffold>
              <Suspense fallback={<WebAppLoadingContentSkeleton />}>
                {children}
              </Suspense>
            </WebAppChromeScaffold>
          </NotificationProvider>
        </WorkspaceTransitionProvider>
      </ProspectProfileProvider>
    </ProfileProvider>
  );
}
