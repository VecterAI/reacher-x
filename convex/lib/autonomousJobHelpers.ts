/**
 * Emergency brake for autonomous provider work.
 *
 * Recovery and retry crons spend OpenRouter credits on background work nobody
 * is watching. Setting `PAUSE_AUTONOMOUS_JOBS=true` in the Convex deployment
 * environment stops those crons from claiming any new work, stops the tenant
 * dispatcher from dispatching queued jobs, and blocks scheduled retries
 * without a redeploy. Unsetting it resumes them within one cron interval:
 *
 *   npx convex env set PAUSE_AUTONOMOUS_JOBS true
 *   npx convex env set PAUSE_AUTONOMOUS_JOBS false
 *
 * Already-running durable jobs are untouched; this only stops new work from
 * starting. Reading one env var costs no database reads, so a paused
 * deployment is effectively free to leave switched off.
 */
import { env } from "../_generated/server";

export function areAutonomousJobsPaused(): boolean {
  const flag = env.PAUSE_AUTONOMOUS_JOBS?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}
