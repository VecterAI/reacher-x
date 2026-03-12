import type { Doc } from "@/convex/_generated/dataModel";

type SetupSessionLike = Pick<
  Doc<"workspaceSetupSessions">,
  "draftOrdinal" | "draftName"
>;

export function formatWorkspaceDraftName(session: SetupSessionLike): string {
  const trimmedName = session.draftName?.trim() ?? "";
  if (trimmedName.length > 0) {
    return `${trimmedName} · draft`;
  }

  return `Untitled · draft · ${session.draftOrdinal}`;
}

export function formatWorkspaceName(name?: string | null): string {
  const trimmedName = name?.trim() ?? "";
  return trimmedName.length > 0 ? trimmedName : "Untitled workspace";
}
