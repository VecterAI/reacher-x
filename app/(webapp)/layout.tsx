// app/(webapp)/layout.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
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
import {
  parseWorkspaceUseCaseKeyParam,
  WORKSPACE_USE_CASE_STORAGE_KEY,
} from "@/shared/lib/workspaceUseCaseCache";
import {
  parseSidebarOpenState,
  SIDEBAR_COOKIE_NAME,
} from "@/shared/lib/sidebarState";
import {
  APP_DESCRIPTION,
  getActiveWorkspaceUseCaseMetadata,
} from "@/shared/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const activeUseCase = await getActiveWorkspaceUseCaseMetadata();

  return {
    title: activeUseCase.pageLabels.entities,
    description: APP_DESCRIPTION,
  };
}

async function WebAppLayoutWithCookies({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieRaw = cookieStore.get(WORKSPACE_USE_CASE_STORAGE_KEY)?.value;
  const initialUseCaseKey = parseWorkspaceUseCaseKeyParam(cookieRaw);
  const initialSidebarOpen = parseSidebarOpenState(
    cookieStore.get(SIDEBAR_COOKIE_NAME)?.value
  );

  return (
    <ActiveUseCaseLabelsProvider initialUseCaseKey={initialUseCaseKey}>
      <NotificationProvider>
        <ProfileProvider>
          <ProspectProfileProvider>
            <WorkspaceTransitionProvider>
              <OnboardingLockGuardProvider>
                <WebAppChromeScaffold
                  initialSidebarOpen={initialSidebarOpen}
                  mode="live"
                >
                  {children}
                </WebAppChromeScaffold>
              </OnboardingLockGuardProvider>
            </WorkspaceTransitionProvider>
          </ProspectProfileProvider>
        </ProfileProvider>
      </NotificationProvider>
    </ActiveUseCaseLabelsProvider>
  );
}

export default function WebAppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <WebAppChromeScaffold initialSidebarOpen={true} mode="loading">
          <WebAppLoadingContentSkeleton />
        </WebAppChromeScaffold>
      }
    >
      <WebAppLayoutWithCookies>{children}</WebAppLayoutWithCookies>
    </Suspense>
  );
}
