export const DEMO_SETUP_THREAD_ID = "demo_setup_thread";
export function getDemoSetupThreadId(scenario?: string) {
  return !scenario || scenario === "getting-started-with-reacherx"
    ? DEMO_SETUP_THREAD_ID
    : `${DEMO_SETUP_THREAD_ID}:${scenario}`;
}
export function getDemoSetupScenario(threadId: string | null) {
  return threadId?.startsWith(`${DEMO_SETUP_THREAD_ID}:`)
    ? threadId.slice(DEMO_SETUP_THREAD_ID.length + 1)
    : undefined;
}
