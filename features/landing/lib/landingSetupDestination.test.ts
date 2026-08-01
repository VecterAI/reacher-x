import { describe, expect, it } from "vitest";
import {
  isLandingWorkspaceCapacityBlocked,
  resolveAuthenticatedLandingSetupHref,
} from "./landingSetupDestination";

describe("authenticated landing setup destination", () => {
  it("starts first-workspace setup when no completed workspace exists", () => {
    expect(resolveAuthenticatedLandingSetupHref(true)).toBe("/agent/setup");
  });

  it("starts or resumes an additional-workspace draft otherwise", () => {
    expect(resolveAuthenticatedLandingSetupHref(false)).toBe(
      "/agent/setup?action=newWorkspace"
    );
  });

  it("routes directly to an existing setup draft", () => {
    expect(resolveAuthenticatedLandingSetupHref(false, "thread_existing")).toBe(
      "/agent/setup?threadId=thread_existing"
    );
  });
});

describe("landing workspace capacity", () => {
  it("blocks creating a new draft when all workspace slots are reserved", () => {
    expect(
      isLandingWorkspaceCapacityBlocked({
        isAuthenticated: true,
        requiresFirstWorkspace: false,
        hasActiveNewWorkspaceDraft: false,
        workspaceCreationAllowed: false,
      })
    ).toBe(true);
  });

  it("allows resuming an existing draft that already reserved its slot", () => {
    expect(
      isLandingWorkspaceCapacityBlocked({
        isAuthenticated: true,
        requiresFirstWorkspace: false,
        hasActiveNewWorkspaceDraft: true,
        workspaceCreationAllowed: false,
      })
    ).toBe(false);
  });

  it("does not apply authenticated capacity checks to anonymous visitors", () => {
    expect(
      isLandingWorkspaceCapacityBlocked({
        isAuthenticated: false,
        requiresFirstWorkspace: false,
        hasActiveNewWorkspaceDraft: false,
        workspaceCreationAllowed: false,
      })
    ).toBe(false);
  });
});
