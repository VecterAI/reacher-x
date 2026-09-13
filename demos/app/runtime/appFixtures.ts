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
          ].includes(scenario)
        ? audienceStories["find-potential-customers"]
        : undefined;
  const workspaces = [
    {
      name:
        editorial === "workspaces"
          ? "Hire a designer"
          : "Hire a frontend engineer",
      useCaseKey: "recruiting" as WorkspaceUseCaseKey,
    },
    {
      name: "People to try the app",
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
      improvedDescription: story.brief,
      icps: [
        {
          title: story.workspace,
          description: story.brief,
          painPoints: [],
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
  const now = getCurrentUTCTimestamp();
  prospects.forEach((person, index) => {
    person._creationTime = now - (index + 1) * 3600000;
    person.qualifiedAt = person._creationTime;
    person.enrichedAt = person._creationTime;
    person.readyAt = person._creationTime;
  });
  if (scenario === "read-your-reacherx-analytics") {
    prospects
      .filter((person) => person.workspaceId === workspaces[0]._id)
      .forEach((person, index) => {
        person._creationTime = now - (index + 1) * 3600000;
        person.qualifiedAt = person._creationTime;
        person.enrichedAt = person._creationTime;
        person.readyAt = person._creationTime;
        person.status =
          index === 1 ? "contacted" : index === 2 ? "in_progress" : "new";
        person.pipelineStage = person.status;
      });
  }
  prospects.push(...createBackgroundProspects(workspaces, prospects));
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
          _creationTime: USE_CASE_DEMO_REFERENCE_TIME,
          prospectId: prospect._id,
          workspaceId: prospect.workspaceId,
          userId: viewer._id,
          status: "draft",
          version: 1,
          updatedAt: USE_CASE_DEMO_REFERENCE_TIME,
          strategy: {
            rationale: prospect.briefIntro ?? story.brief,
            valueProposition: story.brief,
            tone: "Specific, respectful, and direct",
          },
        },
        tasks: [
          {
            _id: `demo_task_${prospect._id}` as Id<"outreachTasks">,
            _creationTime: USE_CASE_DEMO_REFERENCE_TIME,
            planId,
            type: "dm",
            order: 1,
            status: "pending",
            timing: { type: "immediate" },
            description: "Send a personal introduction",
            content: AUDIENCE_DEMO_INVITATIONS[scenario],
            ...(scenario === "find-creators"
              ? {
                  mediaUrls: ["/media/reacherx-workflow.mp4"],
                  mediaKinds: ["video" as const],
                  mediaDescriptions: [
                    "ReacherX candidate evidence and conversation workflow",
                  ],
                }
              : {}),
            approvalReady: false,
            approvalContext: { platform: "linkedin" },
            originalPost: null,
          },
        ],
      });
      continue;
    }
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
        _creationTime: USE_CASE_DEMO_REFERENCE_TIME,
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
        updatedAt: USE_CASE_DEMO_REFERENCE_TIME,
      },
      tasks: fixture.tasks.map((task) => ({
        ...task,
        _id: task._id as Id<"outreachTasks">,
        _creationTime: USE_CASE_DEMO_REFERENCE_TIME,
        planId,
        type: task.type as Doc<"outreachTasks">["type"],
        status: (prospect.platform === "linkedin" &&
        task.status === "waiting_manual"
          ? "pending"
          : task.status) as Doc<"outreachTasks">["status"],
        timing: { type: "immediate" },
        approvalReady:
          prospect.platform === "linkedin"
            ? false
            : (task.approvalReady ?? false),
        approvalContext: { platform: prospect.platform },
        originalPost: null,
      })),
    });
  }
  for (const prospect of prospects)
    if (plans.has(prospect._id)) prospect.planGenerationStatus = "completed";
  return {
    startedAt: getCurrentUTCTimestamp() - 3 * 60000,
    scenario,
    workspaces,
    prospects,
    plans,
    selectedWorkspaceId: workspaces[0]._id,
  };
}
