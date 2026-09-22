import { PUBLIC_OUTREACH_DEMO_COPY } from "@/features/blog/lib/publicOutreachDemoCopy";
import { getStringProperty } from "@/convex/lib/typeGuards";
import { isAudienceDemoId } from "@/features/blog/lib/blogDemoCatalog";
import type { BlogDemoId } from "@/features/blog/lib/blogDemoHelpers";
import { AUDIENCE_DEMO_INVITATIONS } from "@/features/blog/lib/audienceDemoCopy";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { createAppFixtures } from "./appFixtures";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { createPlanPreviewArtifact } from "@/shared/lib/json-render/agentArtifacts";

interface ScenarioMessageDraft {
  description: string;
  content: string;
  media?: { url: string; kind: "image" | "video"; description: string };
}

export function createScenarioDraftPlan(
  state: ReturnType<typeof createAppFixtures>,
  person: Doc<"prospects">,
  input: ScenarioMessageDraft & { threadId: string; rationale: string }
) {
  return createScenarioMessagePlan(state, person, {
    threadId: input.threadId,
    rationale: input.rationale,
    messages: [input],
  });
}

/** Each message is an ordered DM task using the normal approval/send lifecycle. */
export function createScenarioMessagePlan(
  state: ReturnType<typeof createAppFixtures>,
  person: Doc<"prospects">,
  input: {
    threadId: string;
    rationale: string;
    messages: readonly ScenarioMessageDraft[];
  }
) {
  const first = input.messages[0];
  if (!first) throw new Error("A message plan needs at least one draft");
  const now = getCurrentUTCTimestamp();
  const previous = state.plans.get(person._id);
  if (
    previous &&
    !["draft", "completed", "abandoned"].includes(previous.plan.status)
  )
    throw new Error(
      "Finish or cancel the active plan before creating another one"
    );
  // Strict Mode re-runs auto-prompting; a repeated request for the same person
  // must re-present the existing draft instead of orphaning its artifact.
  if (previous && previous.plan.status === "draft") {
    return {
      data: previous,
      artifact: createPlanPreviewArtifact({
        planId: previous.plan._id,
        prospectId: person._id,
        status: previous.plan.status,
        rationale: previous.plan.strategy.rationale,
        tasks: previous.tasks,
      }),
    };
  }
  const version =
    (state.planVersions.get(person._id) ?? previous?.plan.version ?? 0) + 1;
  state.planVersions.set(person._id, version);
  const planId = `demo_plan_${person._id}_${version}` as Id<"outreachPlans">;
  const data: NonNullable<
    ReturnType<typeof createAppFixtures>["plans"] extends Map<string, infer T>
      ? T
      : never
  > = {
    readiness: { requiredPlatforms: [person.platform], missingPlatforms: [] },
    plan: {
      _id: planId,
      _creationTime: now,
      prospectId: person._id,
      workspaceId: person.workspaceId,
      userId: person.userId,
      threadId: input.threadId,
      status: "draft" as const,
      version,
      updatedAt: now,
      strategy: {
        rationale: input.rationale,
        valueProposition: first.description,
        tone: "Helpful and direct",
      },
    },
    tasks: input.messages.map((message, index) => ({
      _id: `demo_task_${person._id}_${version}${index ? `_${index + 1}` : ""}` as Id<"outreachTasks">,
      _creationTime: now,
      planId,
      type: "dm" as const,
      order: index + 1,
      status: "pending" as const,
      timing: { type: "immediate" as const },
      description: message.description,
      content: message.content,
      ...(message.media
        ? {
            mediaUrls: [message.media.url],
            mediaKinds: [message.media.kind],
            mediaDescriptions: [message.media.description],
          }
        : {}),
      approvalReady: false,
      approvalContext: { platform: person.platform },
      originalPost: null,
    })),
  };
  const publicCopy = !first.media && PUBLIC_OUTREACH_DEMO_COPY[state.scenario];
  const post = person.evidencePosts?.[0];
  if (publicCopy && post) {
    data.tasks.forEach((task) => {
      task.order += 1;
    });
    data.tasks.unshift({
      _id: `demo_comment_${person._id}_${version}` as Id<"outreachTasks">,
      _creationTime: now,
      planId,
      type: "comment",
      order: 1,
      status: "pending",
      timing: { type: "immediate" },
      description: "Contribute to their public discussion",
      content: publicCopy.draft,
      targetTweetId: getStringProperty(
        post,
        person.platform === "twitter" ? "id_str" : "postID"
      ),
      approvalReady: false,
      approvalContext: { platform: person.platform },
      originalPost: {
        platform: person.platform,
        postData: post,
        postRef: undefined,
        postSummary: undefined,
      },
    });
  }
  state.plans.set(person._id, data);
  person.planGenerationStatus = "completed";
  return {
    data,
    artifact: createPlanPreviewArtifact({
      planId,
      prospectId: person._id,
      status: "draft",
      rationale: input.rationale,
      tasks: data.tasks,
    }),
  };
}

/** The same workspace brief drives seeded, requested and memory-informed drafts. */
export function buildDemoIntroduction(
  person: Doc<"prospects">,
  workspace: Doc<"workspaces">,
  scenario?: BlogDemoId
) {
  const name = person.displayName?.split(" ")[0] ?? "there";
  const role = workspace.name.includes("product designer")
    ? "product designer"
    : "frontend engineer";
  return {
    description:
      workspace.useCaseKey === "recruiting"
        ? `Introduce the ${role} role`
        : "Send a relevant introduction",
    content:
      scenario &&
      isAudienceDemoId(scenario) &&
      person._id === "use_case_demo_audience_1"
        ? AUDIENCE_DEMO_INVITATIONS[scenario]
        : workspace.useCaseKey === "recruiting"
          ? `Hi ${name}, your work on ${person.matchedKeywords?.slice(0, 2).join(" and ") || "web products"} looks relevant to our ${role} role. We're a team of three in Paris, offering €80–100k for a remote role within three hours of our time zone. Would you like the role details?`
          : workspace.useCaseKey === "customer_prospecting"
            ? `Hi ${name}, I saw your post about keeping client feedback and approvals organised. I'm building a tool for independent designers working with clients. Which part of collecting feedback takes the most time for you?`
            : `Hi ${name}, your recent work caught my attention: ${person.briefIntro} We're working on ${workspace.name.toLowerCase()}. Would you be open to hearing more?`,
  };
}
