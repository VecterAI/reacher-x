export const WORKSPACE_DELETION_TOAST_COPY = {
  loading: "Deleting workspace...",
  success: "Workspace deleted",
  error: "Could not delete workspace",
  errorDescription: "Please try again.",
  retry: "Retry",
} as const;

export function getWorkspaceDeletionToastId(workspaceId: string): string {
  return `workspace-deletion:${workspaceId}`;
}
