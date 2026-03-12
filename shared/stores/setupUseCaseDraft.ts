import { atom } from "nanostores";
import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";

export const $setupUseCaseDraftKey = atom<WorkspaceUseCaseKey | null>(null);

export function setSetupUseCaseDraftKey(
  nextKey: WorkspaceUseCaseKey | null
): void {
  $setupUseCaseDraftKey.set(nextKey);
}
