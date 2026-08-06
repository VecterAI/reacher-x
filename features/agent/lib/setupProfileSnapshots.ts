import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";
import type { Id } from "@/convex/_generated/dataModel";

export type SetupProfileSnapshot = {
  sessionId: Id<"workspaceSetupSessions">;
  mode: "first_workspace" | "new_workspace";
  sourceMessageId: string;
  assistantMessageId: string;
  generationRevision: number;
  useCaseKey: WorkspaceUseCaseKey;
  generatedProfiles: Array<{
    title: string;
    description: string;
    painPoints: string[];
    channels: string[];
    syntheticPosts?: string[];
    qualificationKeywords?: string[];
  }>;
  createdAt: number;
};

type SetupSnapshotMessage = {
  id: string;
  key: string;
  order: number;
  role: string;
};

/**
 * Associates each generated profile snapshot with the assistant response from
 * the same durable Agent turn as its source user message.
 */
export function indexSetupProfileSnapshotsByAssistantMessage(
  messages: SetupSnapshotMessage[],
  snapshots: SetupProfileSnapshot[]
): ReadonlyMap<string, SetupProfileSnapshot> {
  const sourceOrderByMessageId = new Map(
    messages
      .filter((message) => message.role === "user")
      .map((message) => [message.id, message.order] as const)
  );
  const assistantKeyByOrder = new Map<number, string>();
  const assistantKeyByMessageId = new Map<string, string>();

  for (const message of messages) {
    if (message.role === "assistant") {
      assistantKeyByOrder.set(message.order, message.key);
      assistantKeyByMessageId.set(message.id, message.key);
    }
  }

  const snapshotByAssistantKey = new Map<string, SetupProfileSnapshot>();
  for (const snapshot of snapshots) {
    const sourceOrder = sourceOrderByMessageId.get(snapshot.sourceMessageId);
    const assistantKey =
      assistantKeyByMessageId.get(snapshot.assistantMessageId) ??
      (sourceOrder === undefined
        ? undefined
        : assistantKeyByOrder.get(sourceOrder));
    if (!assistantKey) continue;

    const existing = snapshotByAssistantKey.get(assistantKey);
    if (
      !existing ||
      snapshot.generationRevision > existing.generationRevision
    ) {
      snapshotByAssistantKey.set(assistantKey, snapshot);
    }
  }

  return snapshotByAssistantKey;
}
