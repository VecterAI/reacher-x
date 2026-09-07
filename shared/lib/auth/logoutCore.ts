const LOGOUT_TOAST_DELAY_MS = 750;

type LogoutDependencies = {
  clearBrowserData: () => Promise<void>;
  submitLogout: () => void;
  showPending: () => void;
  dismissPending: () => void;
  showError: () => void;
};

/** Keeps one logout running even if its menu closes or the page re-renders. */
export function createLogoutController(dependencies: LogoutDependencies) {
  let attempt: { timer: ReturnType<typeof setTimeout> } | null = null;

  function reset() {
    if (!attempt) return;
    clearTimeout(attempt.timer);
    attempt = null;
    dependencies.dismissPending();
  }

  async function start(): Promise<void> {
    if (attempt) return;
    const currentAttempt = {
      timer: setTimeout(dependencies.showPending, LOGOUT_TOAST_DELAY_MS),
    };
    attempt = currentAttempt;

    try {
      try {
        await dependencies.clearBrowserData();
      } catch (error) {
        // A browser storage failure must not prevent ending the auth session.
        console.error("[Logout] Failed to clear XChat browser data", error);
      }

      // The user may have left while browser cleanup was still pending.
      if (attempt !== currentAttempt) return;
      dependencies.submitLogout();
      // Keep feedback and deduplication active until the document leaves,
      // including time spent waiting for the sign-out response.
    } catch (error) {
      console.error("[Logout] Failed to submit logout", error);
      clearTimeout(currentAttempt.timer);
      attempt = null;
      // Replace the loading toast in place. Dismissing its ID first can also
      // dismiss the error Sonner publishes in the same render.
      dependencies.showError();
    }
  }

  return { start, reset };
}
