import type { AgentServices } from "./agentServices";
import type { createAppFixtures } from "./appFixtures";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";

const HOUR_MS = 3600000;
const MINUTE_MS = 60000;

/**
 * Past agent conversations that make the thread sidebar look lived in. Each
 * thread demonstrates one capability; the scripted walkthrough thread always
 * stays the newest entry.
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
    people.find((item) => item.status === "new" && !state.plans.has(item._id));
  const second = people.find(
    (item) => item.status === "contacted" && item._id !== person?._id
  );

  const planThread: {
    threadId: string;
    hoursAgo: number;
    messages: Array<{ text: string; role: "user" | "assistant" }>;
  } = {
    threadId: "demo_history_plan",
    hoursAgo: 26,
    messages: [],
  };
  if (person) {
    planThread.messages.push({
      role: "user",
      text: `Draft the first plan for ${person.displayName}. Comment on their post first, DM only if it makes sense.`,
    });
  }

  const threads: Array<{
    threadId: string;
    hoursAgo: number;
    messages: Array<{ text: string; role: "user" | "assistant" }>;
  }> = [
    {
      threadId: "demo_history_discovery",
      hoursAgo: 30,
      messages: [
        {
          role: "user",
          text: `Find ${entityLower} who already talk about the problem we solve. Check their recent posts before showing me anyone.`,
        },
        {
          role: "assistant",
          text: `I ran the first discovery cycle: 128 candidates checked, 12 passed your criteria with evidence attached. The strongest matches are waiting in the People tab with the post that qualified each one. I keep cycling, so the list stays fresh.`,
        },
      ],
    },
    ...(planThread.messages.length ? [planThread] : []),
    {
      threadId: "demo_history_engage",
      hoursAgo: 22,
      messages: [
        {
          role: "user",
          text: second
            ? `Like and comment on ${second.displayName}'s latest post. Keep it about their work, not about us.`
            : "Like and comment on the strongest match's latest post. Keep it about their work.",
        },
        {
          role: "assistant",
          text: `Done. I liked the post and commented on their approach with no product mention, so the engagement reads as genuine. I held the DM back until you say the timing is right.`,
        },
      ],
    },
    {
      threadId: "demo_history_media",
      hoursAgo: 20,
      messages: [
        {
          role: "user",
          text: person
            ? `Send ${person.displayName} the demo video with tomorrow's DM.`
            : "Send the demo video with tomorrow's DM.",
        },
        {
          role: "assistant",
          text: "Drafted. The DM waits for your approval with the video attached, and I only include media when it makes the message clearer, never as decoration.",
        },
      ],
    },
    {
      threadId: "demo_history_summary",
      hoursAgo: 8,
      messages: [
        { role: "user", text: "How did last week go?" },
        {
          role: "assistant",
          text: `Last week: 128 new ${entityLower} discovered, 46 matched your criteria, 12 contacted, 5 replies. Reply rate improved about 9%. ${second ? `${second.displayName} has the most active conversation right now.` : "The strongest matches are in the People tab."}`,
        },
      ],
    },
  ];

  const base = Date.now();
  threads.forEach((thread, threadIndex) => {
    agent.seedThreadContext(thread.threadId);
    thread.messages.forEach((message) => {
      agent.append(thread.threadId, message.role, message.text);
    });
    if (thread.threadId === "demo_history_plan" && person) {
      agent.append(
        thread.threadId,
        "assistant",
        `Here is the first plan for ${person.displayName}: a comment on their latest post, then a short DM that references their own words. The plan is in the review panel with the research attached, waiting for your approval.`
      );
    }
    const messages = agent.threads.get(thread.threadId);
    if (!messages) return;
    const threadBase = base - thread.hoursAgo * HOUR_MS;
    messages.forEach((message, messageIndex) => {
      message._creationTime = threadBase + messageIndex * MINUTE_MS;
    });
  });
}
