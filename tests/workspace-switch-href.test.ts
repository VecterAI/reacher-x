import { normalizeProspectProfileData } from "../features/prospects/lib/normalizeProspectProfileData";
import assert from "node:assert/strict";
import test from "node:test";
import { getWorkspaceSwitchHref } from "../shared/lib/urls/workspaceSwitchHref";
import { getWorkspaceRoutes } from "../shared/lib/workspaceRoutes";
import { WORKSPACE_USE_CASE_KEYS } from "../shared/lib/workspaceUseCases";

test("switching workspaces exits each kind of prospect detail", () => {
  for (const key of WORKSPACE_USE_CASE_KEYS) {
    assert.equal(
      getWorkspaceSwitchHref(
        getWorkspaceRoutes(key).detailHref("person-from-old-workspace")
      ),
      "/"
    );
  }
});

test("workspace switching preserves ordinary pages and existing Agent exit behavior", () => {
  for (const path of [
    "/",
    "/analytics",
    "/workspace",
    "/settings/connected-accounts",
    "/agent-ops",
    "/post/x/123",
    null,
    undefined,
  ]) {
    assert.equal(getWorkspaceSwitchHref(path), null);
  }
  for (const path of ["/agent", "/agent/setup"])
    assert.equal(getWorkspaceSwitchHref(path), "/");
});

test("profile normalization preserves a valid workspace ID for navigation guards", () => {
  assert.equal(
    normalizeProspectProfileData({
      _id: "person",
      workspaceId: "hiring",
      platform: "linkedin",
    })?.workspaceId,
    "hiring"
  );
  assert.equal(
    normalizeProspectProfileData({
      _id: "person",
      workspaceId: 123,
      platform: "linkedin",
    })?.workspaceId,
    undefined
  );
});
