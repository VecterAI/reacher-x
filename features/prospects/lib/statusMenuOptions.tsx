import type { ReactNode } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  getWorkspaceStageActionLabel,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";
import {
  ArchiveIcon,
  ForumIcon,
  FramePersonIcon,
  HowToRegIcon,
  MarkChatReadIcon,
} from "@/shared/ui/components/icons";

export type ProspectStatus = Doc<"prospects">["status"];

export type ProspectStatusMenuOption = {
  value: ProspectStatus;
  label: string;
  icon: ReactNode;
};

export const PROSPECT_STATUS_MENU_VALUES = [
  "new",
  "contacted",
  "in_progress",
  "converted",
] as const satisfies readonly ProspectStatus[];

const PROSPECT_STATUS_ICONS: Record<ProspectStatus, ReactNode> = {
  new: <FramePersonIcon className="fill-current" />,
  contacted: <MarkChatReadIcon className="fill-current" />,
  in_progress: <ForumIcon className="fill-current" />,
  converted: <HowToRegIcon className="fill-current" />,
  archived: <ArchiveIcon className="fill-current" />,
};

export function getProspectStatusMenuOptions(
  useCaseKey: WorkspaceUseCaseKey
): ProspectStatusMenuOption[] {
  return PROSPECT_STATUS_MENU_VALUES.map((value) => ({
    value,
    label: getWorkspaceStageActionLabel(useCaseKey, value),
    icon: PROSPECT_STATUS_ICONS[value],
  }));
}
