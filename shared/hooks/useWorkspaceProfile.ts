import { useMemo, useState } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useWorkspaceProfile() {
  const { isAuthenticated, workspace } = useAuth();
  const updateWorkspace = useMutation(api.workspaces.updateWorkspace);

  // Local reactive state used only for unauthenticated users.
  // Authenticated users read directly from workspace prop.
  const [localDescription, setLocalDescription] = useState<string>("");
  const [localName, setLocalName] = useState<string>("Default workspace");

  // Derive description/name directly from workspace when authenticated,
  // otherwise use local state (avoids setState in useEffect)
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
      // Note: workspace prop will update reactively from Convex
    } else {
      // For unauthenticated users, only in-memory state is updated.
      setLocalDescription(value);
    }
  };

  const setName = async (value: string) => {
    if (isAuthenticated && workspace) {
      await updateWorkspace({ workspaceId: workspace._id, name: value });
      // Note: workspace prop will update reactively from Convex
    } else {
      // For unauthenticated users, only in-memory state is updated.
      setLocalName(value);
    }
  };

  return { description, name, setDescription, setName };
}
