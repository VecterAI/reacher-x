import {
  makeProspect,
  USE_CASE_DEMO_PLANS,
  USE_CASE_DEMO_DATASETS,
  type UseCaseDemoKey,
} from "./useCaseDemoData";

export type DemoEditorialScenario = "hiring" | "workspaces";
export function getEditorialDemoDataset(
  key: UseCaseDemoKey,
  scenario?: DemoEditorialScenario
) {
  const dataset =
    USE_CASE_DEMO_DATASETS.find((entry) => entry.key === key) ??
    USE_CASE_DEMO_DATASETS[0];
  if (scenario === "workspaces" && key === "customers") {
    return {
      ...dataset,
      prospects: [
        makeProspect({
          key: "customers_1",
          platform: "twitter",
          displayName: "Daniel Okafor",
          handle: "danielokafor",
          title: "Founder, small product team",
          briefIntro:
            "Looking for a simple way to gather feedback from the first users of his app.",
          signal:
            "We have our first twenty users. How do other tiny product teams collect feedback without a big research process? Happy to try something lightweight.",
          qualificationScore: 94,
          hoursAgo: 2,
          matchedKeywords: ["feedback", "product teams"],
          location: "London, UK",
        }),
        makeProspect({
          key: "customers_2",
          platform: "linkedin",
          displayName: "Sofia Marchetti",
          handle: "sofiamarchetti",
          title: "Product lead",
          briefIntro:
            "Wants to connect customer feedback to the next product decisions.",
          signal:
            "Our team keeps feedback in three places. I'd love to test a simpler way to see what users are asking for.",
          qualificationScore: 91,
          hoursAgo: 5,
          matchedKeywords: ["feedback"],
          location: "Milan, Italy",
        }),
      ],
    };
  }
  if (!scenario || key !== "candidates") return dataset;
  const designer = scenario === "workspaces";
  return {
    ...dataset,
    prospects: [
      makeProspect({
        key: "candidates_1",
        platform: "twitter",
        displayName: "Isabelle Fontaine",
        handle: "isafontaine",
        title: designer ? "Product designer" : "Senior frontend engineer",
        briefIntro: designer
          ? "Designs complex web apps and is open to working with a small product team."
          : "Built keyboard navigation for a complex settings screen. Based in Paris, within three hours of the team's time zone, and open to a small product team.",
        signal: designer
          ? "Just shipped a redesigned settings experience: fewer steps, clearer defaults, and keyboard access throughout. Looking for a small team where I can own the product design."
          : "Rebuilt the keyboard navigation in our settings screen: roving focus, clear focus rings, and predictable Escape behavior. Sharing what worked. I'm also exploring senior frontend roles at small product teams.",
        qualificationScore: 92,
        hoursAgo: 4,
        matchedKeywords: designer
          ? ["product design", "web apps"]
          : ["keyboard navigation", "frontend", "accessibility"],
        location: "Paris, France",
      }),
      ...dataset.prospects
        .slice(1)
        .filter((p) =>
          (designer
            ? /design/i
            : /frontend|front-end|full-stack|product engineer/i
          ).test(p.title ?? "")
        ),
    ],
  };
}
export function getEditorialWorkspaceDescription(
  key: UseCaseDemoKey,
  scenario: DemoEditorialScenario
) {
  if (key === "candidates")
    return scenario === "workspaces"
      ? "We're a small team finishing a web app. Help us find a product designer who has shipped complex interfaces, can explain their work, and wants to own the design. Share the role details before asking for a call."
      : "Help me find frontend engineers on X and LinkedIn who have shared work on accessibility or complex web apps. We're a small team hiring someone to improve our product's UI. They need to work within three hours of our time zone.";
  return "We're building a web app for small product teams. Find founders and product leads who are looking for a better way to understand their users. Invite them to try the app and share feedback. Don't ask for a call in the first message.";
}

export function getEditorialDemoPlan(
  id: string,
  scenario?: DemoEditorialScenario
) {
  const plan = USE_CASE_DEMO_PLANS[id];
  if (!plan || !scenario || id !== "use_case_demo_candidates_1") return plan;
  if (scenario === "workspaces")
    return {
      ...plan,
      rationale:
        "Isabelle has shipped complex interfaces and wants to own design on a small team. Share the product design role and ask whether she would like the details.",
      tasks: plan.tasks.map((task, index) =>
        index === 0
          ? {
              ...task,
              description: "Reply to her product-design post",
              content:
                "Your settings redesign caught my attention, especially the keyboard access. We're a small team looking for someone to own product design. Would you like the role details?",
            }
          : task
      ),
    };
  return {
    ...plan,
    rationale:
      "Isabelle shared work on keyboard navigation in a complex web app. Explain the role, team, and salary range, and ask whether she wants the details.",
    tasks: plan.tasks.map((task, index) =>
      index === 0
        ? {
            ...task,
            description: "Reply to her keyboard-navigation post",
            content:
              "I read your post about making that settings screen work with a keyboard. We're hiring someone to do similar work on our app. It's a remote role on a team of three, €80–100k. Can I send you the details?",
          }
        : task
    ),
  };
}
