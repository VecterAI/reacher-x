import { describe, expect, test, vi } from "vitest";
import {
  runWithWorkspaceMemoryCompliance,
  WorkspaceMemoryComplianceError,
} from "./workspaceMemoryCompliance";
import { resolveWorkspaceMemoryScope } from "./workspaceMemoryScope";
import type { Id } from "../_generated/dataModel";

describe("workspace memory compliance", () => {
  test("regenerates from generic evaluator feedback and returns the repaired value", async () => {
    const repairs: Array<string | undefined> = [];
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce({
        compliant: false,
        violations: ["The saved operator instruction was not followed."],
        repairInstruction: "Rewrite the candidate to follow the instruction.",
      })
      .mockResolvedValueOnce({
        compliant: true,
        violations: [],
        repairInstruction: "",
      });

    const result = await runWithWorkspaceMemoryCompliance({
      instructions: ["Apply my arbitrary natural-language preference."],
      taskContext: "Draft outreach.",
      generate: async (repair) => {
        repairs.push(repair);
        return repair ? "repaired candidate" : "initial candidate";
      },
      serialize: (value) => value,
      evaluate,
    });

    expect(result.value).toBe("repaired candidate");
    expect(result.attempts).toBe(2);
    expect(repairs).toEqual([
      undefined,
      "Rewrite the candidate to follow the instruction.",
    ]);
  });

  test("fails closed after the bounded retry count", async () => {
    await expect(
      runWithWorkspaceMemoryCompliance({
        instructions: ["A generic instruction"],
        taskContext: "A task",
        generate: async () => "still wrong",
        serialize: (value) => value,
        maxAttempts: 2,
        evaluate: async () => ({
          compliant: false,
          violations: ["Still wrong"],
          repairInstruction: "Try again",
        }),
      })
    ).rejects.toBeInstanceOf(WorkspaceMemoryComplianceError);
  });
});

describe("workspace memory scope", () => {
  test("a draft setup thread never falls back to another default workspace", async () => {
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        title: "setup-draft:v1:newWorkspace:leads",
      });
    const scope = await resolveWorkspaceMemoryScope(
      { runQuery } as unknown as Parameters<
        typeof resolveWorkspaceMemoryScope
      >[0],
      {
        userId: "user-1" as Id<"users">,
        threadId: "setup-thread",
        allowDefaultWorkspace: false,
      }
    );

    expect(scope.workspaceId).toBeNull();
    expect(runQuery).toHaveBeenCalledTimes(4);
  });

  test("main context may explicitly use the default workspace fallback", async () => {
    const defaultWorkspaceId = "workspace-1" as Id<"workspaces">;
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ title: "Unlinked main thread" })
      .mockResolvedValueOnce({ _id: defaultWorkspaceId });
    const scope = await resolveWorkspaceMemoryScope(
      { runQuery } as unknown as Parameters<
        typeof resolveWorkspaceMemoryScope
      >[0],
      {
        userId: "user-1" as Id<"users">,
        threadId: "main-thread",
        allowDefaultWorkspace: true,
      }
    );

    expect(scope.workspaceId).toBe(defaultWorkspaceId);
    expect(runQuery).toHaveBeenCalledTimes(5);
  });
});
