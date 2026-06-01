// app/(webapp)/layout.tsx
import type { Metadata } from "next";
import { ReactNode, Suspense } from "react";
import { cookies } from "next/headers";
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
import {
  DEFAULT_SIDEBAR_OPEN,
  parseSidebarOpenState,
  SIDEBAR_COOKIE_NAME,
} from "@/shared/lib/sidebarState";

export const metadata: Metadata = {
  title: "ReacherX",
  description: APP_DESCRIPTION,
};

function WebAppLayoutFrame({ children }: { children: ReactNode }) {
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
      <WebAppLayoutContent>{children}</WebAppLayoutContent>
    </Suspense>
  );
}

async function WebAppLayoutContent({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const initialSidebarOpen = parseSidebarOpenState(
    cookieStore.get(SIDEBAR_COOKIE_NAME)?.value
  );

  return (
    <ActiveUseCaseLabelsProvider initialUseCaseKey={null}>
      <ProfileProvider>
        <ProspectProfileProvider>
          <WorkspaceTransitionProvider>
            <NotificationProvider>
              <OnboardingLockGuardProvider>
                <WebAppChromeScaffold
                  initialSidebarOpen={initialSidebarOpen}
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
  );
}

export default function WebAppLayout({ children }: { children: ReactNode }) {
  return <WebAppLayoutFrame>{children}</WebAppLayoutFrame>;
}
