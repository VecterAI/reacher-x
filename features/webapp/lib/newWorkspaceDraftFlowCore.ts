type SetupSessionMode = "first_workspace" | "new_workspace";

export type NewWorkspaceSessionSelection = {
  kind: "created" | "continued";
  threadId: string;
};

/** Keep Radix AlertDialogAction from closing before an async flow finishes. */
export function runControlledDraftDialogAction(
  event: { preventDefault: () => void },
  action: () => void
): void {
  event.preventDefault();
  action();
}

/**
 * Keep draft replacement as one uninterrupted action. In particular, callers
 * must not interpret the dialog's programmatic close as cancellation between
 * deleting the old draft and selecting the fresh setup session.
 */
export async function replaceWorkspaceDraft<TSessionId>({
  sessionId,
  mode,
  discardSetupSession,
  startSetupSession,
  selectSession,
}: {
  sessionId: TSessionId;
  mode: SetupSessionMode;
  discardSetupSession: (args: { sessionId: TSessionId }) => Promise<unknown>;
  startSetupSession: (args: { mode: SetupSessionMode }) => Promise<{
    threadId: string;
  }>;
  selectSession: (selection: NewWorkspaceSessionSelection) => Promise<void>;
}): Promise<void> {
  await discardSetupSession({ sessionId });
  const result = await startSetupSession({ mode });
  await selectSession({ kind: "created", threadId: result.threadId });
}
