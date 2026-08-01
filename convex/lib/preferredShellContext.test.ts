import { describe, expect, it } from "vitest";
import type { Doc } from "../_generated/dataModel";
import { shouldPreferWorkspaceContext } from "./preferredShellContext";

const readyWorkspace = {
  description: "Recruit senior product designers",
  improvedDescription: "Find senior product designers for a B2B SaaS team.",
  icps: [{ name: "Senior product designer" }],
} as unknown as Doc<"workspaces">;

describe("preferred shell context", () => {
  it("honors an explicit ready-workspace preference", () => {
    expect(shouldPreferWorkspaceContext("workspace", readyWorkspace)).toBe(
      true
    );
  });

  it("does not select workspace context without required agent data", () => {
    const incompleteWorkspace = {
      description: "",
      improvedDescription: undefined,
      icps: [],
    } as unknown as Doc<"workspaces">;

    expect(shouldPreferWorkspaceContext("workspace", incompleteWorkspace)).toBe(
      false
    );
  });
});
