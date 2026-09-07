// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { getSetupTargeting } from "./setupSessionChat";

describe("saved setup targeting tool", () => {
  test("rejects missing identity and a different session owner", async () => {
    for (const userId of [undefined, "other"]) {
      const runQuery = vi.fn().mockResolvedValue({
        userId: "owner",
        generatedProfiles: [{ title: "Private audience" }],
      });
      const tool = {
        ...getSetupTargeting,
        ctx: { threadId: "thread", userId, runQuery },
      };
      const result = await tool.execute!(
        {},
        { toolCallId: "read", messages: [] }
      );
      expect(result).toMatchObject({ success: false });
      expect(result).not.toHaveProperty("profiles");
      if (!userId) expect(runQuery).not.toHaveBeenCalled();
    }
  });
  test("returns saved draft profiles and reads current workspace profiles after setup", async () => {
    for (const status of ["awaiting_icp_confirmation", "ready"]) {
      const runQuery = vi
        .fn()
        .mockResolvedValueOnce({
          userId: "owner",
          status,
          generationRevision: 2,
          targetWorkspaceId: "workspace",
          generatedProfiles: [
            {
              title: "Draft audience",
              description: "Draft criteria",
              painPoints: [],
              channels: [],
            },
          ],
        })
        .mockResolvedValueOnce({
          userId: "owner",
          icps: [
            {
              title: "Updated audience",
              description: "Current criteria",
              painPoints: [],
              channels: [],
            },
          ],
        });
      const tool = {
        ...getSetupTargeting,
        ctx: { threadId: "thread", userId: "owner", runQuery },
      };
      const result = await tool.execute!(
        {},
        { toolCallId: "read", messages: [] }
      );
      expect(result).toMatchObject({
        success: true,
        generationRevision: 2,
        profiles: [
          { title: status === "ready" ? "Updated audience" : "Draft audience" },
        ],
      });
      expect(runQuery).toHaveBeenCalledTimes(status === "ready" ? 2 : 1);
    }
  });
});
