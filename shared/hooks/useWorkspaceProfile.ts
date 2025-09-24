import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  getWorkspaceDescription,
  storeWorkspaceDescription,
  getWorkspaceName,
  storeWorkspaceName,
} from "@/shared/lib/utils/localStorage";

export function useWorkspaceProfile() {
  const { isAuthenticated, workspace } = useAuth();
  const updateWorkspace = useMutation(api.workspaces.updateWorkspace);

  // Local reactive state so unauth users update immediately on localStorage writes
  const [localDescription, setLocalDescription] = useState<string>(
    () => getWorkspaceDescription() || ""
  );
  const [localName, setLocalName] = useState<string>(
    () => getWorkspaceName() || "Default workspace"
  );

  // Keep local state in sync with auth workspace when authenticated
  useEffect(() => {
    if (isAuthenticated && workspace) {
      // Mirror server values into local state for stable consumers
      setLocalDescription(workspace.description);
      setLocalName(workspace.name);
    }
  }, [isAuthenticated, workspace]);

  // Subscribe to localStorage change events when unauthenticated
  useEffect(() => {
    if (isAuthenticated) return;
    const handleLocalChange = () => {
      setLocalDescription(getWorkspaceDescription() || "");
      setLocalName(getWorkspaceName() || "Default workspace");
    };
    window.addEventListener(
      "onLocalStorageChange",
      handleLocalChange as EventListener
    );
    return () => {
      window.removeEventListener(
        "onLocalStorageChange",
        handleLocalChange as EventListener
      );
    };
  }, [isAuthenticated]);

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
      storeWorkspaceDescription(value);
      setLocalDescription(value);
    }
  };

  const setName = async (value: string) => {
    if (isAuthenticated && workspace) {
      await updateWorkspace({ workspaceId: workspace._id, name: value });
      setLocalName(value);
    } else {
      storeWorkspaceName(value);
      setLocalName(value);
    }
  };

  return { description, name, setDescription, setName };
}
