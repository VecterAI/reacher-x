import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { normalizeAgentMessageContextMetadata } from "@/shared/lib/mentions/messageContext";
import { createPlanBatchProgressArtifact } from "@/shared/lib/json-render/agentArtifacts";
import type { AgentServices, AgentMessage } from "../agentServices";
import type { createAppFixtures } from "../appFixtures";
import type { LocalClient } from "../LocalClient";
import { createScenarioDraftPlan } from "../scenarioPlanHelpers";
import { historyPlanBatchRuns } from "../demoPlanBatchRuns";
import type { AudienceStory } from "./audiences";

export const batchStory: AudienceStory = {
  useCaseKey: "partnership_outreach",
  workspace: "Partners — client-feedback workshop",
  brief:
    "Invite a small group to a free workshop about handling client feedback. A speaker, a community host, and a guest each need a different invitation.",
  people: [
    {
      displayName: "Maya Shaw",
      title: "Design educator",
      qualificationScore: 94,
      briefIntro:
        "Teaches practical ways to handle conflicting client feedback.",
      signal:
        "My next lesson is about turning contradictory client comments into one clear decision. Designers need a shared language for this.",
    },
    {
      displayName: "Tom Reed",
      title: "Independent designers community host",
      qualificationScore: 90,
      briefIntro:
        "Runs a community whose members ask for help with design reviews.",
      signal:
        "Our members keep asking how to handle revision requests after a project has been approved. Looking for a practical session we can host.",
    },
    {
      displayName: "Lee Park",
      title: "Freelance product designer",
      qualificationScore: 88,
      briefIntro:
        "Recently asked peers for help managing client review rounds.",
      signal:
        "I'd love to compare notes with other freelancers on client feedback. I keep getting new requests after each review round.",
    },
    {
      displayName: "Maren Vogel",
      title: "Design educator",
      gender: "woman",
      qualificationScore: 89,
      briefIntro:
        "Teaches freelancers how to name a decision owner before each revision round.",
      signal:
        "My next lesson is about choosing one decision owner per client project. Freelancers tell me conflicting approvals cost them whole rounds.",
    },
    {
      displayName: "Idris Sanogo",
      title: "Freelance designers community host",
      gender: "man",
      qualificationScore: 82,
      briefIntro:
        "Runs community meetups whose members ask about approvals scattered across apps.",
      signal:
        "Members asked for a session on approvals that arrive in three different apps. Looking for a practical host, not a product pitch.",
    },
    {
      displayName: "Selin Aydin",
      title: "Independent brand designer",
      gender: "woman",
      qualificationScore: 86,
      briefIntro:
        "Works with clients whose partners approve in chat while their agencies email different directions.",
      signal:
        "A client approved the homepage in chat, then the partner agency emailed a different direction. I'd join a session on handling two approval trails.",
    },
    {
      displayName: "Bruno Ferreira",
      title: "Freelance product designer",
      gender: "man",
      qualificationScore: 80,
      briefIntro:
        "Keeps a numbered change list to stop post-approval revisions restarting projects.",
      signal:
        "Revision requests after sign-off used to restart my projects. A numbered change list finally stopped that. Happy to share what worked.",
    },
    {
      displayName: "Astrid Nilsson",
      title: "Design educator",
      gender: "woman",
      qualificationScore: 88,
      briefIntro:
        "Teaches revision-boundary exercises using real approval emails from her freelance years.",
      signal:
        "The revision-boundary exercise using a real approval email landed hardest with my students. I'd bring that exercise to a practical workshop.",
    },
    {
      displayName: "Malik Johnson",
      title: "Freelance web designer",
      gender: "man",
      qualificationScore: 77,
      briefIntro:
        "Manages clients across time zones who send feedback through three different channels.",
      signal:
        "Two clients, two time zones, three feedback channels. I'd compare tracker approaches with other freelancers in a practical session.",
    },
    {
      displayName: "Paloma Reyes",
      title: "Independent brand designer",
      gender: "woman",
      qualificationScore: 84,
      status: "contacted",
      briefIntro:
        "Records approvals with names and dates to end disputes before they start.",
      signal:
        "The client approved the identity in email; their marketing lead sent new notes in chat a week later. Recording approvals with names and dates is what saved the deadline.",
    },
    {
      displayName: "Viktor Bak",
      title: "Freelance web designer",
      gender: "man",
      qualificationScore: 81,
      status: "contacted",
      briefIntro:
        "Mirrors chat feedback and emailed scope into one project note for every client.",
      signal:
        "Client feedback arrives in chat; the signed scope lives in email. Mirroring both into one project note is the only thing that keeps my weeks sane.",
    },
    {
      displayName: "Noor Hammoud",
      title: "Design community organiser",
      gender: "woman",
      qualificationScore: 87,
      status: "contacted",
      briefIntro:
        "Runs sessions where members share real approval emails and the decisions behind them.",
      signal:
        "Members keep asking how to handle feedback scattered across email and chat. A practical workshop with real examples would suit our group.",
    },
    {
      displayName: "Emil Vidal",
      title: "Independent web designer",
      gender: "man",
      qualificationScore: 79,
      status: "contacted",
      briefIntro:
        "Keeps one approval trail per project after a chat approval contradicted an email.",
      signal:
        "A chat approval contradicted the email from the same morning. The client admitted the chat one was a mistake. One trail per project is the rule now.",
    },
    {
      displayName: "Karen Whitfield",
      title: "Freelance brand and web designer",
      gender: "woman",
      qualificationScore: 83,
      status: "contacted",
      briefIntro:
        "Asks boutique clients to confirm one approval message per milestone.",
      signal:
        "The approvals folder now holds one confirmed message per milestone, and clients actually cooperate. I'd share the exact message template.",
    },
    {
      displayName: "Dario Conti",
      title: "Freelance product designer",
      gender: "man",
      qualificationScore: 85,
      status: "contacted",
      briefIntro:
        "Reconciles approvals from three chats and one email before every delivery.",
      signal:
        "The client's team approved in three chats and one email. Reconciling approvals now takes minutes instead of evenings, and I'd show exactly how.",
    },
    {
      displayName: "Lucy Hammond",
      title: "Independent web designer",
      gender: "woman",
      qualificationScore: 80,
      status: "contacted",
      briefIntro:
        "Restates each approval in one line before building to avoid revision rounds.",
      signal:
        "A client approved version two by email and version three in chat. Restating the decision in one line before building has saved whole rounds.",
    },
    {
      displayName: "Oscar Mendez",
      title: "Freelance UI designer",
      gender: "man",
      qualificationScore: 82,
      status: "contacted",
      briefIntro:
        "Sends a weekly feedback digest that turns three client channels into one ordered summary.",
      signal:
        "Chat feedback, email approvals, and a shared drive nobody curates. My weekly digest turns the three into one summary clients reply to.",
    },
    {
      displayName: "Ida Svensson",
      title: "Design educator",
      gender: "woman",
      qualificationScore: 86,
      status: "contacted",
      briefIntro:
        "Builds workshop sessions from real approval emails contributed by members.",
      signal:
        "Members asked for a practical session on approvals that scatter across apps. I'd host it with real examples contributed in advance.",
    },
    {
      displayName: "Teo Markovic",
      title: "Freelance product designer",
      gender: "man",
      qualificationScore: 83,
      status: "in_progress",
      briefIntro:
        "Keeps one thread and one approval message per milestone so clients cooperate.",
      signal:
        "The client approved in chat at midnight and emailed a different direction at nine. One thread per project and one approval message per milestone fixed it.",
    },
    {
      displayName: "Hana Novak",
      title: "Independent web designer",
      gender: "woman",
      qualificationScore: 88,
      status: "in_progress",
      briefIntro:
        "Keeps an approval line in the project doc that client teams have started copying.",
      signal:
        "The chat decision and the email approval disagreed. The doc version won because it had a date and a name. Two clients have copied the format since.",
    },
    {
      displayName: "Ruben Costa",
      title: "Independent brand designer",
      gender: "man",
      qualificationScore: 80,
      status: "in_progress",
      briefIntro:
        "Quotes every approval back to the client in writing before acting on it.",
      signal:
        "Sign-off happened in chat; the change requests arrive in a shared document. Quoting the approval back in writing has ended every dispute before it started.",
    },
    {
      displayName: "Anouk Peeters",
      title: "Freelance brand designer",
      gender: "woman",
      qualificationScore: 85,
      status: "in_progress",
      briefIntro:
        "Designs the approval ask itself: one message, one place, one decision owner.",
      signal:
        "Three stakeholders, three feedback channels, one screen. The decision log made the review short. Designing the approval ask is now part of my service.",
    },
    {
      displayName: "Sami Kettani",
      title: "Independent web designer",
      gender: "man",
      qualificationScore: 78,
      status: "in_progress",
      briefIntro:
        "Files paper and chat approvals in one project folder for local clients.",
      signal:
        "The restaurant approved the menu page in chat; the change requests keep arriving in a shared document. I photograph the paper approvals too, so the folder is the only complete record.",
    },
    {
      displayName: "Vilma Lind",
      title: "Independent brand designer",
      gender: "woman",
      qualificationScore: 87,
      status: "in_progress",
      briefIntro:
        "Ships an approval summary with every brand round after a wrong-version print.",
      signal:
        "A client approved the wrong logo version from an old email thread. The approval summary now ships with every round and delivery days are calm again.",
    },
    {
      displayName: "Jonas Krause",
      title: "Freelance web designer",
      gender: "man",
      qualificationScore: 82,
      status: "in_progress",
      briefIntro:
        "Runs one numbered change list per project, whatever channel requests arrive in.",
      signal:
        "Chat approvals, email revisions, and a deadline that will not move. One numbered change list per project is doing the work of three apps.",
    },
    {
      displayName: "Priya Bose",
      title: "Freelance product designer",
      gender: "woman",
      qualificationScore: 84,
      status: "in_progress",
      briefIntro:
        "Restates founder chat approvals in one line before the morning email arrives.",
      signal:
        "The founder approves in chat; the ops lead revises by email. My project doc is the only place both exist together, and restating each approval saves rounds.",
    },
    {
      displayName: "Marc Tolentino",
      title: "Independent UI designer",
      gender: "man",
      qualificationScore: 76,
      status: "in_progress",
      briefIntro:
        "Keeps one project doc as the single record for three clients' approval habits.",
      signal:
        "Three clients, three approval habits, one project doc. The doc wins because it is the only thing everyone can find.",
    },
  ],
};
const invitations = [
  "Hi Maya, your lesson on conflicting feedback fits a free workshop we're organising for independent designers. Would you give a ten-minute practical talk? We'll handle hosting and share your work with attendees. No product pitch.",
  "Hi Tom, you mentioned members asking about revision requests after approval. We're hosting a free 30-minute workshop on client feedback. Would you share it with your community? I'll send a short description and registration link so you can decide if it fits.",
  "Hi Lee, I saw your question about feedback arriving after each review round. We're holding a free workshop for independent designers to compare approaches. Would you join the discussion as a guest? No presentation or preparation needed.",
];
type Run = NonNullable<
  FunctionReturnType<typeof api.planBatches.getPlanBatchRun>
>;

export function registerBatchStory(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>,
  agent: AgentServices
) {
  const runs = new Map<string, Run>();
  // Registered in every scenario so history cards with batch runs resolve too.
  client.register(
    api.planBatches.getPlanBatchRun,
    ({ runId }) => runs.get(runId) ?? historyPlanBatchRuns.get(runId) ?? null
  );
  if (state.scenario !== "create-plans-for-several-people") return;
  agent.addResponder(({ threadId, prompt, metadata, messageId }) => {
    const context = normalizeAgentMessageContextMetadata(metadata);
    const ids = new Set(
      context?.taggedEntities
        .filter((entity) => entity.kind === "prospect")
        .map((entity) => entity.prospectId ?? entity.entityId)
    );
    const people = state.prospects.filter(
      (person) =>
        ids.has(person._id) && person.workspaceId === state.selectedWorkspaceId
    );
    if (!people.length || !/plan|retry|try.*again/i.test(prompt)) return false;
    const storyPeople = people.map((person) => ({
      person,
      index: batchStory.people.findIndex(
        (item) => item.displayName === person.displayName
      ),
    }));
    // Unsupported people must not leave a completed run or an empty draft.
    if (storyPeople.some(({ index }) => index < 0)) return false;
    const firstBatch = runs.size === 0;
    if (firstBatch && people.length !== 3) return false;
    const pending = storyPeople.filter(
      ({ person }) => !state.plans.has(person._id)
    );
    const skippedCount = storyPeople.length - pending.length;
    const completed = pending.filter(
      ({ person }) => !(firstBatch && person._id === "use_case_demo_audience_3")
    );
    const failedCount = pending.length - completed.length;
    const runId = `demo_batch_${runs.size + 1}` as Id<"planBatchRuns">;
    const run: Run = {
      _id: runId,
      fitScoreMin: undefined,
      fitScoreMax: undefined,
      operation: "create",
      scopeKind: "tagged",
      status: failedCount ? "partial" : "completed",
      targetCount: people.length,
      eligibleCount: pending.length,
      succeededCount: completed.length,
      createdCount: completed.length,
      updatedCount: 0,
      failedCount,
      skippedCount,
      selectionSkippedCount: 0,
      finishedCount: people.length,
      targetNames: people.map((person) => person.displayName ?? "Person"),
      issues: failedCount
        ? [
            {
              id: "demo_lee_timeout",
              prospectName: "Lee Park",
              reason:
                "The plan generation request timed out. Retry this person.",
            },
          ]
        : [],
    };
    runs.set(runId, run);
    const parts: AgentMessage["parts"] = [
      {
        type: "tool-managePlanBatch",
        toolCallId: `batch_${messageId}`,
        state: "output-available",
        input: {},
        output: {
          success: true,
          artifact: createPlanBatchProgressArtifact({ runId }),
        },
      },
    ];
    for (const { person, index } of completed) {
      const { artifact } = createScenarioDraftPlan(state, person, {
        threadId,
        description: [
          "Invite Maya to give a short talk",
          "Ask Tom to share the workshop",
          "Invite Lee to join as a guest",
        ][index],
        content: invitations[index],
        rationale: `${person.displayName}: ${person.briefIntro} ${index === 0 ? "Ask for a short teaching contribution." : index === 1 ? "Ask him to share it; do not ask him to speak." : "Invite participation, without a speaking obligation."}`,
      });
      parts.push({
        type: "tool-getProspectPlan",
        toolCallId: `plan_${person._id}_${messageId}`,
        state: "output-available",
        input: {},
        output: { success: true, artifact },
      });
    }
    const text = failedCount
      ? "Maya's speaking invitation and Tom's community invitation are ready to review. Lee's plan request timed out; the other two plans are saved. Retry Lee only."
      : "Lee's guest invitation is ready. Maya's and Tom's plans are unchanged. Review the invitations before approving them.";
    parts.push({ type: "text", text });
    agent.append(threadId, "assistant", text, undefined, parts);
    return true;
  });
}
