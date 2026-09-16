"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { ConvexProviderWithAuth } from "convex/react";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/shared/ui/components/Sonner";
import { ActiveUseCaseLabelsProvider } from "@/shared/contexts/ActiveUseCaseLabelsProvider";
import { ProfileProvider } from "@/features/profile/contexts/TwitterProfileContext";
import { ProspectProfileProvider } from "@/features/prospects/contexts";
import { WorkspaceTransitionProvider } from "@/features/webapp/contexts/WorkspaceTransitionContext";
import {
  OnboardingLockGuardProvider,
  WebAppChromeScaffold,
} from "@/features/webapp/ui/components";
import { createAppServices } from "./appServices";
import { workosViewer } from "./appFixtures";
import { isBlogDemoId } from "@/features/blog/lib/blogDemoHelpers";
import { PlaybackBridge } from "./PlaybackBridge";
import { AnimationActivityProvider } from "@/shared/contexts/AnimationActivityProvider";
import { ThemeProvider } from "@/shared/ui/components/ThemeProvider";

import { getDemoSetupScenario } from "./scenarios/setupHelpers";
import { lockXChatInBrowser } from "./demoXChatBrowserSession";
import { installVoiceSample } from "./voiceSample";
import { installDemoHistory } from "./demoHistoryHelpers";

const auth = {
  isLoading: false,
  isAuthenticated: true,
  fetchAccessToken: async () => null,
};
function useLocalAuth() {
  return auth;
}

export function AppEnvironment({ children }: { children: ReactNode }) {
  useLayoutEffect(() => installDemoHistory(window), []);
  const search = useSearchParams();
  const [animationActive, setAnimationActive] = useState(false);
  useEffect(() => {
    if (window.parent === window) setAnimationActive(true);
  }, []);
  const [theme, setTheme] = useState<"light" | "dark">();
  const [scenario] = useState(() => {
    const value =
      search.get("scenario") ??
      getDemoSetupScenario(search.get("threadId")) ??
      window.name.replace(/^reacherx-demo:/, "");
    return isBlogDemoId(value)
      ? value
      : window.location.pathname === "/agent/setup"
        ? "getting-started-with-reacherx"
        : "manage-people-with-reacherx";
  });
  useEffect(() => {
    // Real routes remove the entry query. Keep identity on this iframe's
    // browsing context so a document navigation cannot load another story.
    window.name = `reacherx-demo:${scenario}`;
  }, [scenario]);
  useEffect(() => installVoiceSample(), []);
  const [session, setSession] = useState(() => ({
    id: 0,
    services: createAppServices(scenario),
  }));
  const sessionId = useRef(0);
  const reset = useCallback(() => {
    const id = ++sessionId.current;
    lockXChatInBrowser();
    setSession({ id, services: createAppServices(scenario) });
    return id;
  }, [scenario]);
  const { services } = session;
  const activeServices = useRef<typeof services | null>(null);
  useEffect(() => {
    activeServices.current = services;
    return () => {
      activeServices.current = null;
      // Strict Mode reactivates this same session before the microtask runs.
      queueMicrotask(() => {
        if (activeServices.current !== services) void services.client.close();
      });
    };
  }, [services]);
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      forcedTheme={theme}
    >
      <PlaybackBridge
        scenario={scenario}
        reset={reset}
        onTheme={setTheme}
        onActivity={setAnimationActive}
      />
      <AnimationActivityProvider active={animationActive}>
        <div
          data-demo-session={session.id}
          style={{
            visibility:
              window.parent !== window && !theme ? "hidden" : undefined,
          }}
        >
          <AuthKitProvider
            key={session.id}
            initialAuth={{ user: workosViewer, sessionId: "demo_session" }}
            onSessionExpired={false}
          >
            <ConvexProviderWithAuth
              client={services.client}
              useAuth={useLocalAuth}
            >
              <NuqsAdapter>
                <ActiveUseCaseLabelsProvider initialUseCaseKey="recruiting">
                  <ProfileProvider>
                    <ProspectProfileProvider>
                      <WorkspaceTransitionProvider>
                        {/* Sample workspaces are already populated. Background job
                          notifications would invent events on each replay; real
                          user-action toasts still use the shared Toaster below. */}
                        <Suspense fallback={null}>
                          <OnboardingLockGuardProvider>
                            {null}
                          </OnboardingLockGuardProvider>
                        </Suspense>
                        <WebAppChromeScaffold>{children}</WebAppChromeScaffold>
                      </WorkspaceTransitionProvider>
                    </ProspectProfileProvider>
                  </ProfileProvider>
                </ActiveUseCaseLabelsProvider>
              </NuqsAdapter>
              <Toaster {...(theme ? { theme } : {})} />
            </ConvexProviderWithAuth>
          </AuthKitProvider>
        </div>
      </AnimationActivityProvider>
    </ThemeProvider>
  );
}
