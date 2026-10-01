/**
 * Emergency brake for autonomous provider work.
 *
 * Provider-backed background work (recovery crons, retry loops, embeddings,
 * SocialAPI calls) spends credits around the clock. Setting
 * `PAUSE_AUTONOMOUS_JOBS=true` in the Convex deployment environment stops
 * every cron-gated function from doing work: recovery and retry crons claim
 * nothing, the tenant dispatcher dispatches nothing, scheduled qualification
 * retries start nothing, and the maintenance crons (usage rollover, lane
 * reconcile, lease reaping, history cleanup, monitor retirement, receipt
 * and RAG cleanup, DM subscription retries, grant recovery) skip their runs.
 * Unsetting it resumes everything within one cron interval:
 *
 *   npx convex env set PAUSE_AUTONOMOUS_JOBS true
 *   npx convex env set PAUSE_AUTONOMOUS_JOBS false
 *
 * Already-running durable jobs and user-initiated work are untouched; this
 * only stops new background work from starting. Reading one env var costs
 * no database reads, so a paused deployment is effectively free to leave
 * switched off.
 */
import { env } from "../_generated/server";

export function areAutonomousJobsPaused(): boolean {
  const flag = env.PAUSE_AUTONOMOUS_JOBS?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}
