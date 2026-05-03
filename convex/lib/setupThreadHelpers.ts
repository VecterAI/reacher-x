import {
  DEFAULT_WORKSPACE_USE_CASE_KEY,
  resolveWorkspaceUseCaseKey,
  type WorkspaceUseCaseKey,
} from "../../shared/lib/workspaceUseCases";

const SETUP_THREAD_TITLE_PREFIX = "setup:";
const SETUP_THREAD_DRAFT_PREFIX = "setup-draft:";
const SETUP_THREAD_DRAFT_VERSION = "v1";

export type SetupThreadBootstrapMode = "default" | "newWorkspace";

export type SetupThreadDraftState = {
  kind: "draft";
  mode: SetupThreadBootstrapMode;
  useCaseKey: WorkspaceUseCaseKey;
};

export type SetupThreadWorkspaceState = {
  kind: "workspace";
  workspaceId: string;
};

export type ParsedSetupThreadState =
  | SetupThreadDraftState
  | SetupThreadWorkspaceState;

export function resolveSetupThreadBootstrapMode(
  value: unknown
): SetupThreadBootstrapMode {
  return value === "newWorkspace" ? "newWorkspace" : "default";
}

export function createSetupThreadDraftTitle(args: {
  mode?: unknown;
  useCaseKey?: unknown;
}): string {
  const mode = resolveSetupThreadBootstrapMode(args.mode);
  const useCaseKey = resolveWorkspaceUseCaseKey(args.useCaseKey);
  return `${SETUP_THREAD_DRAFT_PREFIX}${SETUP_THREAD_DRAFT_VERSION}:${mode}:${useCaseKey}`;
}

export function getSetupThreadTitle(workspaceId: string): string {
  return `${SETUP_THREAD_TITLE_PREFIX}${workspaceId}`;
}

export function parseSetupThreadState(
  title: unknown
): ParsedSetupThreadState | null {
  if (typeof title !== "string" || title.length === 0) {
    return null;
  }

  if (title.startsWith(SETUP_THREAD_DRAFT_PREFIX)) {
    const payload = title.slice(SETUP_THREAD_DRAFT_PREFIX.length);
    const [version, modeValue, useCaseValue, ...rest] = payload.split(":");
    if (version !== SETUP_THREAD_DRAFT_VERSION || rest.length > 0) {
      return null;
    }

    return {
      kind: "draft",
      mode: resolveSetupThreadBootstrapMode(modeValue),
      useCaseKey: resolveWorkspaceUseCaseKey(useCaseValue),
    };
  }

  if (title.startsWith(SETUP_THREAD_TITLE_PREFIX)) {
    const workspaceId = title.slice(SETUP_THREAD_TITLE_PREFIX.length).trim();
    if (!workspaceId) {
      return null;
    }

    return {
      kind: "workspace",
      workspaceId,
    };
  }

  return null;
}

export function getFallbackSetupThreadDraftState(): SetupThreadDraftState {
  return {
    kind: "draft",
    mode: "default",
    useCaseKey: DEFAULT_WORKSPACE_USE_CASE_KEY,
  };
}
