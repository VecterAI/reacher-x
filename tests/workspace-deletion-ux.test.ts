import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getWorkspaceDeletionToastId,
  WORKSPACE_DELETION_TOAST_COPY,
} from "../shared/lib/workspaceDeletionToast";

const workspacePageSource = readFileSync(
  "features/webapp/workspace/WorkspacePage.tsx",
  "utf8"
);
const notificationProviderSource = readFileSync(
  "features/webapp/ui/components/NotificationProvider.tsx",
  "utf8"
);
const deletionToastHookSource = readFileSync(
  "shared/hooks/useWorkspaceDeletionToast.ts",
  "utf8"
);

test("workspace deletion uses the established progress-toast copy", () => {
  assert.deepEqual(WORKSPACE_DELETION_TOAST_COPY, {
    loading: "Deleting workspace...",
    success: "Workspace deleted",
    error: "Could not delete workspace",
    errorDescription: "Please try again.",
    retry: "Retry",
  });
  assert.equal(
    getWorkspaceDeletionToastId("workspace-id"),
    "workspace-deletion:workspace-id"
  );
});

test("workspace deletion starts loading feedback and completes globally", () => {
  assert.match(
    workspacePageSource,
    /toast\.loading\(WORKSPACE_DELETION_TOAST_COPY\.loading/
  );
  assert.doesNotMatch(
    workspacePageSource,
    /toast\.success\("Workspace deleted"/
  );
  assert.match(notificationProviderSource, /useWorkspaceDeletionToast\(\)/);
  assert.match(
    deletionToastHookSource,
    /toast\.success\(WORKSPACE_DELETION_TOAST_COPY\.success/
  );
  assert.match(
    deletionToastHookSource,
    /label: WORKSPACE_DELETION_TOAST_COPY\.retry/
  );
});
