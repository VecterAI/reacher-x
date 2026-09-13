"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import type { ProspectCardMenuActions } from "@/features/prospects/ui/components/prospect-card/ProspectCardMenu";
import { toast } from "sonner";
import { getDemoWorkspaceUseCaseKey } from "../demoLabels";
import { useDemoShell } from "../demoShellContext";

export type DemoProspectView = "profile" | "conversation" | "platform";

/** Supply effects to the production menu; its markup and action ordering stay shared. */
export function useDemoProspectActions({
  onStatusChange,
  onOpen,
  onOpenAgent,
}: {
  onStatusChange: (id: string, status: Doc<"prospects">["status"]) => void;
  onOpen: (id: string, view: DemoProspectView) => void;
  onOpenAgent: (prospect: Doc<"prospects">) => void;
}) {
  const { useCaseKey, labels } = useDemoShell();
  const key = getDemoWorkspaceUseCaseKey(useCaseKey);
  return (prospect: Doc<"prospects">): ProspectCardMenuActions => ({
    useCaseKey: key,
    onStatusChange: (status) => {
      onStatusChange(prospect._id, status);
      toast.success(
        status === "archived"
          ? `${labels.entitySingular} moved to archive`
          : prospect.status === "archived" && status === "new"
            ? `${labels.entitySingular} restored to ${labels.entityPlural.toLowerCase()}`
            : `${labels.entitySingular} marked as ${labels.stageLabels[status]}`
      );
    },
    onOpenConversation: () => onOpen(prospect._id, "conversation"),
    onOpenAgent: () => onOpenAgent(prospect),
    onViewPlatformProfile: () => onOpen(prospect._id, "platform"),
    onShareProfile: () => {
      const url = new URL(window.location.href);
      url.hash = new URLSearchParams({ prospect: prospect._id }).toString();
      navigator.clipboard.writeText(url.href).then(
        () =>
          toast.success("Copied!", {
            description: `${labels.entitySingular} profile link copied.`,
          }),
        () => toast.error("Error!", { description: "Unable to copy." })
      );
    },
  });
}
