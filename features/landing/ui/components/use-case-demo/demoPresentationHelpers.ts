import type { Doc } from "@/convex/_generated/dataModel";
import type { UseCaseDemoKey } from "./useCaseDemoData";
import type { DemoPageKey } from "./UseCaseDemoShell";

export const DEMO_DESIGN_WIDTH = 1280;
export const DEMO_DESIGN_HEIGHT = 850;

/** Checkpoint state for seeking and replay. Ordinary playback preserves local state. */
export interface DemoPresentation {
  useCase: UseCaseDemoKey;
  page: DemoPageKey;
  selected?: boolean;
  listTab?: "new" | "contacted" | "in_progress";
  profileTab?:
    | "overview"
    | "relevant-activity"
    | "interactions"
    | "activity-log";
  profileScroll?: number;
  profileMenu?: boolean;
  conversation?: boolean;
  status?: Doc<"prospects">["status"];
  workspaceMenu?: boolean;
  workspaceTab?: "details" | "profiles" | "agent";
}
