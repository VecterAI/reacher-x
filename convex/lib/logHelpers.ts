/**
 * Shared logging format helpers.
 * Keeps context formatting consistent without wrapping console methods.
 */

export function formatWorkspaceLogContext(args: {
  workspaceId?: string | null;
  workspaceName?: string | null;
}): string {
  const workspaceId = args.workspaceId ?? null;
  const workspaceName = args.workspaceName ?? null;

  if (!workspaceId && !workspaceName) {
    return "[workspace:unknown]";
  }
  if (workspaceName && workspaceId) {
    return `[workspace:${workspaceName} id=${workspaceId}]`;
  }
  if (workspaceName) {
    return `[workspace:${workspaceName}]`;
  }
  return `[workspace:id=${workspaceId}]`;
}
