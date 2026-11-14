import type { AgentServices } from "./agentServices";
import type { createAppFixtures } from "./appFixtures";
import type { Doc } from "@/convex/_generated/dataModel";
import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";
import {
  createMemoryArtifact,
  createPlanPreviewArtifact,
} from "@/shared/lib/json-render/agentArtifacts";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";
import portraitSource from "./portraitAssets.json";

const portraits: Record<string, { path: string }> = portraitSource;

const HOUR_MS = 3600000;
const MINUTE_MS = 60000;
const DAY_MS = 24 * HOUR_MS;

type Prospect = Doc<"prospects">;

/** Build the mention payload the real composer sends with tagged people. */
function mentionEntity(prospect: Prospect): MentionEntitySearchResult {
  const portrait = portraits[prospect.displayName ?? ""];
  return {
    id: `mention_${prospect._id}`,
    entityId: prospect._id,
    kind: "prospect",
    label: prospect.displayName ?? "",
    mentionText: prospect.displayName ?? "",
    secondaryLabel: prospect.title ?? "",
    avatarUrl: portrait?.path ?? null,
    verified: false,
    prospectId: prospect._id,
  };
}

function mentionMetadata(people: Prospect[]): {
  version: 1;
  promptTextSource: "user";
  taggedEntities: MentionEntitySearchResult[];
  attachments: [];
} {
  return {
    version: 1,
    promptTextSource: "user",
    taggedEntities: people.map(mentionEntity),
    attachments: [],
  };
}

function planCard(
  person: Prospect,
  tasks: Array<{
    type: string;
    description: string;
    status: string;
    content?: string;
  }>
) {
  return createPlanPreviewArtifact({
    planId: `demo_history_plan_${person._id}`,
    prospectId: person._id,
    status: "completed",
    rationale: `${person.displayName} posted firsthand evidence that matches the workspace brief. Comment first, then a DM that references their own words.`,
    tasks: tasks.map((task, index) => ({
      _id: `demo_history_plan_task_${index + 1}`,
      order: index + 1,
      ...task,
    })),
  });
}

/**
 * Past agent conversations that make the thread sidebar look lived in. Every
 * thread goes through the same message shapes the real AgentChat renders:
 * mention chips from taggedEntities, tool parts, and artifact cards. Threads
 * never mutate fixture plan state, so scenario contracts keep their clean
 * start.
 */
export function seedAgentHistory(
  agent: AgentServices,
  state: ReturnType<typeof createAppFixtures>
) {
  const workspace = state.workspaces.find(
    (item) => item._id === state.selectedWorkspaceId
  )!;
  const useCase = getWorkspaceUseCase(workspace.useCaseKey);
  const entityLower = useCase.entityPlural.toLowerCase();
  const people = state.prospects.filter(
    (person) => person.workspaceId === workspace._id
  );
  const person =
    people.find((item) => item._id === "use_case_demo_audience_30") ??
    people.find((item) => item._id === "use_case_demo_candidates_29") ??
    people.find((item) => item.status === "new");
  const second =
    people.find(
      (item) => item.status === "contacted" && item._id !== person?._id
    ) ?? people.find((item) => item._id !== person?._id);
  if (!person || !second) return;

  const base = Date.now();
  const seed = (
    threadId: string,
    hoursAgo: number,
    messages: Array<{
      role: "user" | "assistant";
      text: string;
      metadata?: {
        version: 1;
        promptTextSource: "user";
        taggedEntities: MentionEntitySearchResult[];
        attachments: never[];
      };
      parts?: Parameters<AgentServices["append"]>[4];
    }>
  ) => {
    agent.seedThreadContext(threadId);
    messages.forEach((message) => {
      agent.append(
        threadId,
        message.role,
        message.text,
        message.metadata,
        message.parts
      );
    });
    const stored = agent.threads.get(threadId);
    if (!stored) return;
    const threadBase = base - hoursAgo * HOUR_MS;
    stored.forEach((message, messageIndex) => {
      message._creationTime = threadBase + messageIndex * MINUTE_MS;
    });
  };

  const firstName = (name: string | null | undefined) =>
    name?.split(" ")[0] ?? "there";

  // 1. Plain-words discovery with the real search tool.
  seed("demo_history_discovery", 30, [
    {
      role: "user",
      text: `Find ${entityLower} who already talk about the problem we solve. Check their recent posts before showing me anyone.`,
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-searchProspects",
          toolCallId: "demo_history_discovery_search",
          state: "output-available",
          input: { query: workspace.description ?? "" },
          output: { success: true, count: 128 },
        },
        {
          type: "text",
          text: `I ran the first discovery cycle: 128 candidates checked, 12 passed your criteria with evidence attached. The strongest matches are waiting in the People tab with the post that qualified each one. I keep cycling, so the list stays fresh.`,
        },
      ],
      text: "",
    },
  ]);

  // 2. Plan draft with mentions and the inline approval card.
  seed("demo_history_plan", 26, [
    {
      role: "user",
      text: `@${person.displayName} draft the first plan for them. Comment on their post first, DM only if it makes sense.`,
      metadata: mentionMetadata([person]),
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-generatePlan",
          toolCallId: "demo_history_plan_generate",
          state: "output-available",
          input: { prospectId: person._id },
          output: {
            success: true,
            artifact: planCard(person, [
              {
                type: "comment",
                description: `Reply to ${firstName(person.displayName)}'s post`,
                status: "completed",
              },
              {
                type: "dm",
                description: "Send a personal introduction",
                status: "completed",
                content: `Hi ${firstName(person.displayName)}, your post about keeping feedback in one place stood out. We are a small team working on exactly that. Open to a short look at what we built?`,
              },
              {
                type: "wait",
                description: "Wait for their reply",
                status: "completed",
              },
            ]),
          },
        },
        {
          type: "text",
          text: `Plan completed for ${firstName(person.displayName)}: comment first, then the DM referencing their own words. The full card is above with every task logged.`,
        },
      ],
      text: "",
    },
  ]);

  // 3. Bulk plans from multiple tagged people.
  const bulkTagged = people
    .filter(
      (item) =>
        item._id !== person._id &&
        item._id !== second._id &&
        item.status === "new"
    )
    .slice(0, 3);
  if (bulkTagged.length >= 2) {
    seed("demo_history_bulk", 24, [
      {
        role: "user",
        text: `${bulkTagged
          .map((item) => `@${item.displayName}`)
          .join(", ")} create one plan for each of them, same rules as before.`,
        metadata: mentionMetadata(bulkTagged),
      },
      {
        role: "assistant",
        parts: [
          {
            type: "tool-managePlanBatch",
            toolCallId: "demo_history_bulk_batch",
            state: "output-available",
            input: {},
            output: { success: true, createdCount: bulkTagged.length },
          },
          {
            type: "text",
            text: `Done. ${bulkTagged.length} plans are ready in the Plans tab, one per person. Each opens with a comment on their latest post and follows your saved copy rules. Nothing sends until you approve.`,
          },
        ],
        text: "",
      },
    ]);
  }

  // 4. Social engagement with the real social-action tool.
  seed("demo_history_engage", 22, [
    {
      role: "user",
      text: `@${second.displayName} like and comment on their latest post. Keep it about their work, not about us.`,
      metadata: mentionMetadata([second]),
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-getSocialContext",
          toolCallId: "demo_history_engage_context",
          state: "output-available",
          input: { prospectId: second._id },
          output: { success: true },
        },
        {
          type: "tool-socialAction",
          toolCallId: "demo_history_engage_action",
          state: "output-available",
          input: { action: "like-and-comment", prospectId: second._id },
          output: {
            success: true,
            result: {
              platform: second.platform,
              comment:
                "The way you separated signal from noise here is rare. Curious what you build next.",
            },
          },
        },
        {
          type: "text",
          text: `Done. I liked the post and commented from your account: "The way you separated signal from noise here is rare. Curious what you build next." No product mention, and I held the DM until you say the timing is right.`,
        },
      ],
      text: "",
    },
  ]);

  // 5. Media found on the web and attached to a drafted DM.
  seed("demo_history_media", 20, [
    {
      role: "user",
      text: `@${person.displayName} find an image online that fits their post and send it with a short DM.`,
      metadata: mentionMetadata([person]),
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-webResearch",
          toolCallId: "demo_history_media_search",
          state: "output-available",
          input: { query: `${person.displayName} workflow screenshot` },
          output: {
            success: true,
            found: "https://picsum.photos/seed/reacherx-demo/640/360",
          },
        },
        {
          type: "text",
          text: `I found a public screenshot from their own thread showing the workflow they described. Draft below: the image goes first so the context lands before my line, and it waits for your approval like every DM.`,
        },
      ],
      text: "",
    },
  ]);

  // 6. Teaching the agent a rule it stores as workspace memory (three days ago).
  seed("demo_history_memory", (3 * DAY_MS) / HOUR_MS, [
    {
      role: "user",
      text: "Remember this for outreach: never open with a question about funding, and only mention the demo when it clarifies the message.",
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-rememberWorkspaceMemory",
          toolCallId: "demo_history_memory_save",
          state: "output-available",
          input: {
            summary:
              "Never open with a question about funding; mention the demo only when it clarifies the message.",
          },
          output: {
            success: true,
            memoryId: "demo_history_memory_1",
            artifact: createMemoryArtifact({
              memoryId: "demo_history_memory_1",
              workspaceId: String(workspace._id),
              title: "Never open with a question about funding",
              category: "outreach",
              source: "agent",
              confidence: 0.9,
              impactScore: 70,
            }),
          },
        },
        {
          type: "text",
          text: "Saved for this workspace: never open with a question about funding, and the demo only appears when it clarifies the message. I apply both to every future plan.",
        },
      ],
      text: "",
    },
  ]);

  // 7. A weekly summary in the agent's own voice.
  seed("demo_history_summary", 8, [
    { role: "user", text: "How did last week go?" },
    {
      role: "assistant",
      text: `Last week: 128 new ${entityLower} discovered, 46 matched your criteria, 12 contacted, 5 replies. Reply rate improved about 9%. ${firstName(second.displayName)} has the most active conversation right now.`,
    },
  ]);
}
