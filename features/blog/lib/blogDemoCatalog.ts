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
  if (
    scenario === "introducing-reacherx-v4" ||
    scenario === "getting-started-with-reacherx" ||
    scenario === "find-candidates" ||
    isAudienceDemoId(scenario)
  )
    return "/agent/setup";
  if (scenario === "what-reacherx-does-automatically") return "/workspace";
  if (
    scenario === "teach-reacherx-what-you-want" ||
    scenario === "reach-out-writing-preferences"
  )
    return "/agent";
  if (scenario === "read-your-reacherx-analytics") return "/analytics";
  if (scenario === "understand-agent-observability") return "/agent-ops";
  return ["find-candidates", "introducing-reacherx-v4"].includes(scenario) ||
    isAudienceDemoId(scenario)
    ? "/workspace"
    : "/";
}

/** Several stories can illustrate different sections of the same article. */
export function getBlogDemoArticleSlug(scenario: string) {
  return [
    "reach-out-writing-preferences",
    "reach-out-personal-video",
    "reach-out-message-bubbles",
    "reach-out-unicode-formatting",
  ].includes(scenario)
    ? "reach-out-and-get-replies"
    : scenario;
}
