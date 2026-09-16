import { buildDemoIntroduction } from "./scenarioPlanHelpers";
import { startOfMonth, subMonths } from "date-fns";
import { batchStory } from "./scenarios/batch";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { USE_CASE_DEMO_REFERENCE_TIME } from "@/features/landing/ui/components/use-case-demo/useCaseDemoData";
import {
  getEditorialDemoDataset,
  getEditorialDemoPlan,
  getEditorialWorkspaceDescription,
} from "@/features/landing/ui/components/use-case-demo/demoEditorialHelpers";
import type { BlogDemoId } from "@/features/blog/lib/blogDemoHelpers";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { isAudienceDemoId } from "@/features/blog/lib/blogDemoCatalog";
import { AUDIENCE_DEMO_INVITATIONS } from "@/features/blog/lib/audienceDemoCopy";
import { audienceStories, createAudienceProspect } from "./scenarios/audiences";
import { applyDemoPortrait } from "./portraitHelpers";
import { createBackgroundProspects } from "./backgroundProspectHelpers";
import {
  createSecondaryCustomers,
  populateDemoResearch,
} from "./researchFixtureHelpers";
import type { DemoLifecycle } from "./lifecycleHelpers";

export const viewer = {
  _id: "demo_viewer" as Id<"users">,
  _creationTime: +subMonths(startOfMonth(getCurrentUTCTimestamp()), 2),
  workosUserId: "user_demo_viewer",
  email: "maya@example.test",
  firstName: "Maya",
  lastName: "Chen",
} satisfies Doc<"users">;

export const workosViewer = {
  object: "user" as const,
  id: viewer.workosUserId,
  email: viewer.email,
  firstName: viewer.firstName,
  lastName: viewer.lastName,
  emailVerified: true,
  profilePictureUrl: null,
  createdAt: new Date(viewer._creationTime).toISOString(),
  updatedAt: "2026-08-01T18:00:00.000Z",
  locale: null,
  lastSignInAt: null,
  externalId: null,
  metadata: {},
};

export function createAppFixtures(
  scenario: BlogDemoId = "manage-people-with-reacherx"
) {
  const editorial =
    scenario === "workspaces-explained" ? "workspaces" : "hiring";
  const story = isAudienceDemoId(scenario)
    ? audienceStories[scenario]
    : scenario === "create-plans-for-several-people"
      ? batchStory
      : [
            "write-with-autocomplete",
            "outreach-with-images-and-video",
            "manage-dm-conversations",
            "send-voice-notes",
            "reach-out-writing-preferences",
            "reach-out-personal-video",
            "reach-out-message-bubbles",
            "reach-out-unicode-formatting",
          ].includes(scenario)
        ? audienceStories["find-potential-customers"]
        : undefined;
  const workspaces = [
    {
      name:
        editorial === "workspaces"
          ? "Hiring — product designer"
          : "Hiring — frontend engineer",
      useCaseKey: "recruiting" as WorkspaceUseCaseKey,
    },
    {
      name: "Customers — freelance designers",
      useCaseKey: "customer_prospecting" as WorkspaceUseCaseKey,
    },
  ].map((workspace, index) => ({
    ...workspace,
    _id: `demo_workspace_${index}` as Id<"workspaces">,
    _creationTime: viewer._creationTime,
    userId: viewer._id,
    description: getEditorialWorkspaceDescription(
      index === 0 ? "candidates" : "customers",
      editorial
    ),
    styleProfileStatus: "ready" as const,
    styleProfileVersion: 1,
    improvedDescription: getEditorialWorkspaceDescription(
      index === 0 ? "candidates" : "customers",
      editorial
    ),
    icps: [
      {
        title:
          index === 0
            ? editorial === "workspaces"
              ? "Product designers"
              : "Frontend engineers"
            : "Product teams",
        description:
          index === 0
            ? "People with experience simplifying complex web apps."
            : "Small teams looking for a better way to find customers.",
        painPoints: [],
        channels: ["twitter", "linkedin"],
      },
    ] as NonNullable<Doc<"workspaces">["icps"]>,
    prospectingWorkflowStatus: "running" as NonNullable<
      Doc<"workspaces">["prospectingWorkflowStatus"]
    >,
    isDefault: index === 0,
    fitScoreMin: 70,
    fitScoreMax: 100,
    setupCompletedAt: viewer._creationTime,
    updatedAt: USE_CASE_DEMO_REFERENCE_TIME,
  }));
  if (story)
    Object.assign(workspaces[0], {
      name: story.workspace,
      useCaseKey: story.useCaseKey,
      description: story.brief,
      improvedDescription: `${story.brief} Prioritise current firsthand evidence and exclude people whose role, stage or responsibilities do not fit.`,
      icps: [
        {
          title: story.people[0].title,
          description: `${story.brief} Use recent firsthand activity to verify fit before proposing outreach.`,
          painPoints: [story.people[0].briefIntro],
          channels: ["linkedin", "twitter"],
        },
      ],
    });
  const prospects: Doc<"prospects">[] = workspaces.flatMap(
    (workspace, index) => {
      if (story && index === 0)
        return story.people.map((person, personIndex) => ({
          ...createAudienceProspect(
            person,
            personIndex,
            scenario === "manage-dm-conversations" && personIndex === 2
              ? "twitter"
              : "linkedin"
          ),
          workspaceId: workspace._id,
          userId: viewer._id,
          enrichmentStatus: "enriched" as const,
          qualifiedAt: USE_CASE_DEMO_REFERENCE_TIME,
          enrichedAt: USE_CASE_DEMO_REFERENCE_TIME,
          readyAt: USE_CASE_DEMO_REFERENCE_TIME,
        }));
      if (index === 1) return createSecondaryCustomers(workspace);
      const dataset = getEditorialDemoDataset(
        index === 0 ? "candidates" : "customers",
        editorial,
        "linkedin"
      );
      return dataset.prospects.slice(0, 8).map((prospect) =>
        applyDemoPortrait({
          ...prospect,
          workspaceId: workspace._id,
          userId: viewer._id,
          enrichmentStatus: "enriched" as const,
          qualifiedAt: prospect._creationTime,
          enrichedAt: prospect._creationTime,
          readyAt: prospect._creationTime,
        })
      );
    }
  );
  Object.assign(workspaces[1], {
    description: audienceStories["find-potential-customers"].brief,
    improvedDescription:
      "Find independent designers with current client projects and evidence of fragmented feedback. Exclude full-time educators and people who no longer do client work.",
    icps: [
      {
        title: "Freelance designers with active client projects",
        description:
          "Independent brand and web designers who personally collect client feedback and approvals.",
        painPoints: [
          "Feedback scattered across email and chat",
          "Unclear approval history",
        ],
        channels: ["twitter", "linkedin"],
      },
    ],
  });
  const now = getCurrentUTCTimestamp();
  prospects.forEach((person, index) => {
    person._creationTime = now - (index + 1) * 3600000;
    person.qualifiedAt = person._creationTime;
    person.enrichedAt = person._creationTime;
    person.readyAt =
      person.qualificationStatus === "qualified"
        ? person._creationTime
        : undefined;
    if (!story && person._id === "use_case_demo_candidates_7")
      person.location = "Lyon, France";
    if (!story && person._id === "use_case_demo_candidates_10") {
      person.status = "archived";
      person.pipelineStage = "archived";
      person.qualificationStatus = "disqualified";
      person.qualificationScore = 28;
      person.readyAt = undefined;
      person.briefIntro =
        "TypeScript experience is relevant, but the role requires working within three hours of Paris. Based in Austin; no relocation or compatible working hours have been established.";
    }
    populateDemoResearch(person, index);
  });
  if (!story) {
    workspaces[0].description +=
      " Our team has three people and is based in Paris. This is a permanent remote role paying €80–100k, within three hours of Paris working hours.";
    workspaces[0].improvedDescription = workspaces[0].description;
  }
  if (scenario === "read-your-reacherx-analytics") {
    prospects
      .filter((person) => person.workspaceId === workspaces[0]._id)
      .forEach((person, index) => {
        person._creationTime =
          now - [3600000, 2 * 86400000, 5 * 86400000, 9 * 86400000][index % 4];
        person.qualifiedAt = person._creationTime;
        person.enrichedAt = person._creationTime;
        person.readyAt = person._creationTime;
        person.status =
          person.qualificationStatus === "disqualified"
            ? "archived"
            : index === 1
              ? "contacted"
              : index === 3
                ? "in_progress"
                : "new";
        person.readyAt =
          person.qualificationStatus === "qualified"
            ? person._creationTime
            : undefined;
        person.pipelineStage = person.status;
        populateDemoResearch(person, index);
      });
  }
  const background = createBackgroundProspects(workspaces, prospects).filter(
    (person) =>
      person.workspaceId !== workspaces[0]._id ||
      !(
        isAudienceDemoId(scenario) ||
        scenario === "find-candidates" ||
        scenario === "introducing-reacherx-v4"
      )
  );
  background.forEach((person, index) =>
    populateDemoResearch(person, prospects.length + index)
  );
  prospects.push(...background);
  if (scenario === "how-reacherx-enrichment-works") {
    const person = prospects[0];
    person.socialProfiles = {
      ...person.socialProfiles,
      twitter: {
        username: "isabelle_demo",
        url: "https://x.com/isabelle_demo",
      },
    };
  }
  const plans = new Map<
    string,
    NonNullable<FunctionReturnType<typeof api.outreach.getProspectPlan>>
  >();
  for (const prospect of prospects) {
    if (
      story &&
      prospect.workspaceId === workspaces[0]._id &&
      isAudienceDemoId(scenario)
    ) {
      if (prospect._id !== "use_case_demo_audience_1") continue;
      const planId = `demo_plan_${prospect._id}` as Id<"outreachPlans">;
      plans.set(prospect._id, {
        readiness: {
          requiredPlatforms: [prospect.platform],
          missingPlatforms: [],
        },
        plan: {
          _id: planId,
          _creationTime: now,
          prospectId: prospect._id,
          workspaceId: prospect.workspaceId,
          userId: viewer._id,
          status: "draft",
          version: 1,
          updatedAt: now,
          strategy: {
            rationale: prospect.briefIntro ?? story.brief,
            valueProposition: story.brief,
            tone: "Specific, respectful, and direct",
          },
        },
        tasks: [
          {
            _id: `demo_task_${prospect._id}` as Id<"outreachTasks">,
            _creationTime: now,
            planId,
            type: "dm",
            order: 1,
            status: "pending",
            timing: { type: "immediate" },
            description: "Send a personal introduction",
            content: AUDIENCE_DEMO_INVITATIONS[scenario],
            approvalReady: false,
            approvalContext: { platform: "linkedin" },
            originalPost: null,
          },
        ],
      });
      continue;
    }
    if (
      prospect.workspaceId === workspaces[1]._id ||
      prospect.status === "archived"
    )
      continue;
    const fixture = getEditorialDemoPlan(prospect._id, editorial);
    if (!fixture) continue;
    const planId = `demo_plan_${prospect._id}` as Id<"outreachPlans">;
    plans.set(prospect._id, {
      readiness: {
        requiredPlatforms: [prospect.platform],
        missingPlatforms: [],
      },
      plan: {
        _id: planId,
        _creationTime: now,
        prospectId: prospect._id,
        workspaceId: prospect.workspaceId,
        userId: viewer._id,
        status: fixture.status,
        strategy: {
          rationale: fixture.rationale,
          valueProposition:
            "Share a relevant opportunity based on their recent work.",
          tone: "Friendly and direct",
        },
        version: 1,
        updatedAt: now,
      },
      tasks: fixture.tasks.map((task) => ({
        ...task,
        _id: task._id as Id<"outreachTasks">,
        _creationTime: now,
        planId,
        type: task.type as Doc<"outreachTasks">["type"],
        status: (prospect.platform === "linkedin" &&
        task.status === "waiting_manual"
          ? "pending"
          : task.status) as Doc<"outreachTasks">["status"],
        timing:
          task.type === "wait"
            ? { type: "delay", value: "2d" }
            : { type: "immediate" },
        approvalReady:
          prospect.platform === "linkedin"
            ? false
            : (task.approvalReady ?? false),
        approvalContext: { platform: prospect.platform },
        originalPost: null,
      })),
    });
  }
  if (!story) {
    for (const [id, data] of plans) {
      const person = prospects.find((person) => person._id === id)!;
      const workspace = workspaces.find(
        (item) => item._id === person.workspaceId
      )!;
      const introduction = buildDemoIntroduction(person, workspace, scenario);
      data.plan.status = "draft";
      data.plan.strategy.rationale =
        person.qualificationReasoning ??
        person.briefIntro ??
        "Review the relevant experience.";
      data.tasks = data.tasks.slice(0, 1);
      Object.assign(data.tasks[0], {
        type: "dm",
        ...introduction,
        status: "pending",
        timing: { type: "immediate" },
        approvalReady: false,
      });
    }
  }
  for (const prospect of prospects)
    if (plans.has(prospect._id)) prospect.planGenerationStatus = "completed";
  return {
    startedAt: getCurrentUTCTimestamp() - 3 * 60000,
    scenario,
    workspaces,
    prospects,
    plans,
    planVersions: new Map(
      [...plans].map(([id, data]) => [id, data.plan.version])
    ),
    selectedWorkspaceId: workspaces[0]._id,
    lifecycle: {
      activity: [],
      interactions: [],
      replies: new Map(),
    } as DemoLifecycle,
  };
}
