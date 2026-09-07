const LOGOUT_TOAST_DELAY_MS = 750;
const LOGOUT_NAVIGATION_TIMEOUT_MS = 15_000;

type LogoutAttempt = {
  toastTimer: ReturnType<typeof setTimeout>;
  navigationTimer?: ReturnType<typeof setTimeout>;
};

type LogoutDependencies = {
  clearBrowserData: () => Promise<void>;
  submitLogout: () => void;
  showPending: () => void;
  dismissPending: () => void;
  showError: () => void;
};

/** Keeps one logout running even if its menu closes or the page re-renders. */
export function createLogoutController(dependencies: LogoutDependencies) {
  let attempt: LogoutAttempt | null = null;

  function clearAttempt() {
    if (!attempt) return;
    clearTimeout(attempt.toastTimer);
    clearTimeout(attempt.navigationTimer);
    attempt = null;
  }

  function reset() {
    if (!attempt) return;
    clearAttempt();
    dependencies.dismissPending();
  }

  function fail(currentAttempt: LogoutAttempt) {
    if (attempt !== currentAttempt) return;
    clearAttempt();
    // Replace the toast in place. Dismissing its ID first can also dismiss
    // the error Sonner publishes in the same render.
    dependencies.showError();
  }

  async function start(): Promise<void> {
    if (attempt) return;
    const currentAttempt: LogoutAttempt = {
      toastTimer: setTimeout(dependencies.showPending, LOGOUT_TOAST_DELAY_MS),
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
      // Keep the toast delay independent of the deadline for navigation.
      // Arm this before submitting so even a synchronous reset cancels it.
      currentAttempt.navigationTimer = setTimeout(
        () => fail(currentAttempt),
        LOGOUT_NAVIGATION_TIMEOUT_MS
      );
      dependencies.submitLogout();
    } catch (error) {
      console.error("[Logout] Failed to submit logout", error);
      fail(currentAttempt);
    }
  }

  return { start, reset };
}
