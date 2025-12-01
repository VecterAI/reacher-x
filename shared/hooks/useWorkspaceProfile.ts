import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useWorkspaceProfile() {
  const { isAuthenticated, workspace } = useAuth();
  const updateWorkspace = useMutation(api.workspaces.updateWorkspace);

  // Local reactive state used only as a mirror of Convex data.
  // Unauthenticated users are no longer persisted via localStorage.
  const [localDescription, setLocalDescription] = useState<string>("");
  const [localName, setLocalName] = useState<string>("Default workspace");

  // Keep local state in sync with auth workspace when authenticated
  useEffect(() => {
    if (isAuthenticated && workspace) {
      // Mirror server values into local state for stable consumers
      setLocalDescription(workspace.description);
      setLocalName(workspace.name);
    }
  }, [isAuthenticated, workspace]);

  // Expose description/name values depending on auth
  const description = useMemo(() => {
    return isAuthenticated && workspace
      ? workspace.description
      : localDescription;
  }, [isAuthenticated, workspace, localDescription]);

  const name = useMemo(() => {
    return isAuthenticated && workspace ? workspace.name : localName;
  }, [isAuthenticated, workspace, localName]);

  const setDescription = async (value: string) => {
    if (isAuthenticated && workspace) {
      await updateWorkspace({ workspaceId: workspace._id, description: value });
      // Mirror immediately in local state for instant UI
      setLocalDescription(value);
    } else {
      // For unauthenticated users, only in-memory state is updated.
      setLocalDescription(value);
    }
  };

  const setName = async (value: string) => {
    if (isAuthenticated && workspace) {
      await updateWorkspace({ workspaceId: workspace._id, name: value });
      setLocalName(value);
    } else {
      // For unauthenticated users, only in-memory state is updated.
      setLocalName(value);
    }
  };

  return { description, name, setDescription, setName };
}
