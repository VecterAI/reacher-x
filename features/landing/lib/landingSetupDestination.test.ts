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
  it("blocks the landing composer when all workspace slots are reserved", () => {
    expect(
      isLandingWorkspaceCapacityBlocked({
        isAuthenticated: true,
        requiresFirstWorkspace: false,
        workspaceCreationAllowed: false,
      })
    ).toBe(true);
  });

  it("keeps the landing composer available when the plan has capacity", () => {
    expect(
      isLandingWorkspaceCapacityBlocked({
        isAuthenticated: true,
        requiresFirstWorkspace: false,
        workspaceCreationAllowed: true,
      })
    ).toBe(false);
  });

  it("keeps first-workspace setup available for its dedicated onboarding flow", () => {
    expect(
      isLandingWorkspaceCapacityBlocked({
        isAuthenticated: true,
        requiresFirstWorkspace: true,
        workspaceCreationAllowed: false,
      })
    ).toBe(false);
  });

  it("does not apply authenticated capacity checks to anonymous visitors", () => {
    expect(
      isLandingWorkspaceCapacityBlocked({
        isAuthenticated: false,
        requiresFirstWorkspace: false,
        workspaceCreationAllowed: false,
      })
    ).toBe(false);
  });
});
