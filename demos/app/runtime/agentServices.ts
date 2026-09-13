import { paginateLocalRows } from "./paginationHelpers";
import { api } from "@/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import type { createAppFixtures } from "./appFixtures";
import type { LocalClient } from "./LocalClient";

export type AgentMessage = FunctionReturnType<
  typeof api.chat.listThreadMessages
>["page"][number];
type Metadata = FunctionArgs<
  typeof api.chat.initiateStreamingMessage
>["metadata"];
export interface AgentRequest {
  threadId: string;
  prompt: string;
  metadata?: Metadata;
  prospectId?: Id<"prospects">;
  messageId: string;
  order: number;
}

/** Message persistence and API contracts. Scenario responses are registered separately. */
export function registerAgentServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>
) {
  const threads = new Map<string, AgentMessage[]>();
  const routeOverrides = new Map<
    string,
    FunctionReturnType<typeof api.chat.getThreadRouteContext>
  >();
  const contexts = new Map<
    string,
    { workspaceId: Id<"workspaces">; prospectId?: Id<"prospects"> }
  >();
  const responders: Array<(request: AgentRequest) => boolean> = [];
  const createdAt = getCurrentUTCTimestamp();
  let sequence = 0;
  const append = (
    threadId: string,
    role: "user" | "assistant",
    text: string,
    metadata?: Metadata,
    parts?: AgentMessage["parts"]
  ) => {
    const messages = threads.get(threadId) ?? [];
    const id = `demo_message_${++sequence}`;
    const previousOrder = messages.at(-1)?.order ?? -1;
    const order =
      role === "user" ? previousOrder + 1 : Math.max(0, previousOrder);
    messages.push({
      id,
      key: id,
      role,
      text,
      order,
      stepOrder: role === "user" ? 0 : 1,
      status: "success",
      parts: parts ?? [{ type: "text", text }],
      _creationTime: createdAt + sequence,
      ...(metadata ? { metadata } : {}),
    });
    threads.set(threadId, messages);
    return { messageId: id, order };
  };
  client.register(api.chat.getThreadRouteContext, ({ threadId }) => {
    if (routeOverrides.has(threadId)) return routeOverrides.get(threadId)!;
    const context = contexts.get(threadId) ?? {
      workspaceId: state.selectedWorkspaceId,
    };
    return context.prospectId
      ? {
          kind: "prospect" as const,
          workspaceId: context.workspaceId,
          prospectId: context.prospectId,
        }
      : { kind: "workspace" as const, workspaceId: context.workspaceId };
  });
  client.register(api.chat.getThreadSelectedContext, () => null);
  client.register(api.chat.getThreadGenerationState, () => ({
    status: "idle" as const,
  }));
  client.register(
    api.chat.listThreadMessages,
    ({ threadId, streamArgs, paginationOpts }) => ({
      ...(paginationOpts.numItems === 0
        ? { page: [], isDone: true, continueCursor: "" }
        : paginateLocalRows(
            [...(threads.get(threadId) ?? [])].reverse(),
            paginationOpts
          )),
      streams:
        streamArgs?.kind === "list"
          ? { kind: "list" as const, messages: [] }
          : streamArgs
            ? { kind: "deltas" as const, deltas: [] }
            : undefined,
    })
  );
  client.register(
    api.chat.listWorkspaceThreadsWithMessages,
    ({ workspaceId, paginationOpts }) =>
      paginateLocalRows(
        [...threads.entries()]
          .filter(
            ([id, messages]) =>
              messages.length &&
              contexts.get(id)?.workspaceId ===
                (workspaceId ?? state.selectedWorkspaceId) &&
              !contexts.get(id)?.prospectId
          )
          .map(([id, messages]) => ({
            _id: id,
            _creationTime: messages[0]._creationTime,
            status: "active" as const,
            title: messages[0].text.slice(0, 80),
            firstMessage: messages[0].text,
          }))
          .reverse(),
        paginationOpts
      )
  );
  client.register(api.agentTelemetry.getThreadModelName, () => null);
  client.register(api.planBatches.getPlanBatchTurnState, () => null);
  client.register(api.setupSessions.getSetupSessionState, () => null);
  client.register(api.setupSessions.getSetupBootstrapState, () => ({
    activeSession: null,
    suggestedMode: null,
    requiresFirstWorkspace: false,
  }));
  client.register(api.setupSessions.listSetupProfileSnapshots, () => []);
  const respond = (
    threadId: string,
    prompt: string,
    metadata?: Metadata,
    prospectId?: Id<"prospects">
  ) => {
    if (!contexts.has(threadId))
      contexts.set(threadId, {
        workspaceId: state.selectedWorkspaceId,
        prospectId,
      });
    const result = append(threadId, "user", prompt, metadata);
    const request = {
      threadId,
      prompt,
      metadata,
      prospectId: prospectId ?? contexts.get(threadId)?.prospectId,
      ...result,
    };
    if (!responders.some((handler) => handler(request)))
      append(
        threadId,
        "assistant",
        "This interactive example covers the requests shown in the walkthrough. Replay it to try the demonstrated workflow."
      );
    return result;
  };
  client.register(
    api.chat.initiateStreamingMessage,
    ({ threadId, prompt, metadata }) => respond(threadId, prompt, metadata)
  );
  client.register(
    api.chat.sendProspectMessage,
    ({ threadId, prompt, metadata }) => respond(threadId, prompt, metadata)
  );
  client.register(
    api.chat.createWorkspaceThreadWithPrompt,
    ({ prompt, metadata }) => {
      const threadId = `demo_thread_${threads.size + 1}`;
      return { threadId, ...respond(threadId, prompt, metadata) };
    }
  );
  client.register(
    api.chat.createProspectThreadWithPrompt,
    ({ prompt, metadata, prospectId }) => {
      const threadId = `demo_thread_${threads.size + 1}`;
      return { threadId, ...respond(threadId, prompt, metadata, prospectId) };
    }
  );
  return {
    threads,
    append,
    setRoute: (
      threadId: string,
      route: FunctionReturnType<typeof api.chat.getThreadRouteContext>
    ) => routeOverrides.set(threadId, route),
    addResponder: (handler: (request: AgentRequest) => boolean) =>
      responders.push(handler),
  };
}
export type AgentServices = ReturnType<typeof registerAgentServices>;
