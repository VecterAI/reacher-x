export const AUDIENCE_DEMO_IDS = [
  "find-potential-customers",
  "find-investors",
  "find-research-participants",
  "find-partners",
  "find-creators",
  "find-community-members",
  "find-podcast-guests",
] as const;
export type AudienceDemoId = (typeof AUDIENCE_DEMO_IDS)[number];

export function isAudienceDemoId(value: string): value is AudienceDemoId {
  return AUDIENCE_DEMO_IDS.some((id) => id === value);
}

/** Route metadata only. All mock services and fixtures stay in demos/app. */
export function getBlogDemoInitialPath(scenario: string) {
  if (scenario === "create-plans-for-several-people") return "/agent";
  if (scenario === "getting-started-with-reacherx") return "/agent/setup";
  if (scenario === "what-reacherx-does-automatically") return "/workspace";
  if (scenario === "teach-reacherx-what-you-want") return "/agent";
  if (scenario === "read-your-reacherx-analytics") return "/analytics";
  if (scenario === "understand-agent-observability") return "/agent-ops";
  return ["find-candidates", "introducing-reacherx-v4"].includes(scenario) ||
    isAudienceDemoId(scenario)
    ? "/workspace"
    : "/";
}
