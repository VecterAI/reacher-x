import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";

type RevisionRefreshTimer = number | ReturnType<typeof globalThis.setTimeout>;

export interface RevisionRefreshCoordinator {
  request(revision: string): void;
  dispose(): void;
}

interface RevisionRefreshCoordinatorOptions {
  refresh: () => Promise<void>;
  canRefresh: () => boolean;
  getRetryAt: (error: unknown) => number | undefined;
  onError?: (error: unknown) => void;
  now?: () => number;
  setTimeout?: (callback: () => void, delayMs: number) => RevisionRefreshTimer;
  clearTimeout?: (timeoutId: RevisionRefreshTimer) => void;
}

/**
 * Coalesces reactive conversation revisions into one newest-page refresh.
 *
 * A revision that arrives during an active request replaces any older queued
 * revision. Rate limits schedule exactly one trailing retry at the provider's
 * retryAt; ordinary failures pause until a new revision arrives, so this
 * helper can never become a polling loop.
 */
export function createRevisionRefreshCoordinator(
  options: RevisionRefreshCoordinatorOptions
): RevisionRefreshCoordinator {
  const now = options.now ?? getCurrentUTCTimestamp;
  const schedule = options.setTimeout ?? globalThis.setTimeout;
  const cancel = options.clearTimeout ?? globalThis.clearTimeout;
  let queuedRevision: string | undefined;
  let completedRevision: string | undefined;
  let retryAt: number | undefined;
  let retryTimeout: RevisionRefreshTimer | undefined;
  let inFlight = false;
  let pausedAfterFailure = false;
  let disposed = false;

  const clearRetryTimeout = () => {
    if (retryTimeout === undefined) return;
    cancel(retryTimeout);
    retryTimeout = undefined;
  };

  const scheduleRetry = (drain: () => void) => {
    if (!retryAt || retryAt <= now() || retryTimeout !== undefined) return;
    retryTimeout = schedule(
      () => {
        retryTimeout = undefined;
        retryAt = undefined;
        pausedAfterFailure = false;
        drain();
      },
      Math.max(0, retryAt - now())
    );
  };

  const drain = () => {
    if (
      disposed ||
      inFlight ||
      pausedAfterFailure ||
      !queuedRevision ||
      !options.canRefresh()
    ) {
      return;
    }
    if (queuedRevision === completedRevision) {
      queuedRevision = undefined;
      return;
    }
    if (retryAt && retryAt > now()) {
      scheduleRetry(drain);
      return;
    }

    const requestedRevision = queuedRevision;
    queuedRevision = undefined;
    inFlight = true;
    void options
      .refresh()
      .then(() => {
        completedRevision = requestedRevision;
        retryAt = undefined;
        pausedAfterFailure = false;
        clearRetryTimeout();
      })
      .catch((error: unknown) => {
        const nextRetryAt = options.getRetryAt(error);
        if (nextRetryAt && nextRetryAt > now()) {
          retryAt = nextRetryAt;
          queuedRevision ??= requestedRevision;
        } else if (!queuedRevision) {
          queuedRevision = requestedRevision;
          pausedAfterFailure = true;
        }
        options.onError?.(error);
      })
      .finally(() => {
        inFlight = false;
        if (retryAt && retryAt > now()) {
          scheduleRetry(drain);
          return;
        }
        drain();
      });
  };

  return {
    request(revision) {
      if (disposed || !revision || revision === completedRevision) return;
      queuedRevision = revision;
      pausedAfterFailure = false;
      drain();
    },
    dispose() {
      disposed = true;
      queuedRevision = undefined;
      clearRetryTimeout();
    },
  };
}
