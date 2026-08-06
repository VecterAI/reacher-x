import { describe, expect, it } from "vitest";
import { indexSetupProfileSnapshotsByAssistantMessage } from "./setupProfileSnapshots";

const profiles = [
  {
    title: "React contributors",
    description: "Developers looking for an open-source React project.",
    painPoints: ["Finding maintained projects"],
    channels: ["Twitter"],
  },
];

describe("indexSetupProfileSnapshotsByAssistantMessage", () => {
  it("keeps each snapshot attached to the assistant response from its source turn", () => {
    const indexed = indexSetupProfileSnapshotsByAssistantMessage(
      [
        { id: "user-1", key: "user-1", order: 1, role: "user" },
        {
          id: "assistant-1",
          key: "assistant-1",
          order: 1,
          role: "assistant",
        },
        { id: "user-2", key: "user-2", order: 2, role: "user" },
        {
          id: "assistant-2",
          key: "assistant-2",
          order: 2,
          role: "assistant",
        },
      ],
      [
        {
          sessionId: "session-1" as never,
          mode: "first_workspace",
          sourceMessageId: "user-1",
          assistantMessageId: "assistant-1",
          generationRevision: 1,
          useCaseKey: "recruiting",
          generatedProfiles: profiles,
          createdAt: 1,
        },
        {
          sessionId: "session-1" as never,
          mode: "first_workspace",
          sourceMessageId: "user-2",
          assistantMessageId: "assistant-2",
          generationRevision: 2,
          useCaseKey: "recruiting",
          generatedProfiles: [
            { ...profiles[0], title: "Next.js contributors" },
          ],
          createdAt: 2,
        },
      ]
    );

    expect(indexed.get("assistant-1")?.generationRevision).toBe(1);
    expect(indexed.get("assistant-2")?.generationRevision).toBe(2);
  });

  it("does not move a snapshot when a later assistant message arrives", () => {
    const snapshot = {
      sessionId: "session-1" as never,
      mode: "first_workspace" as const,
      sourceMessageId: "user-1",
      assistantMessageId: "assistant-1",
      generationRevision: 1,
      useCaseKey: "recruiting" as const,
      generatedProfiles: profiles,
      createdAt: 1,
    };
    const indexed = indexSetupProfileSnapshotsByAssistantMessage(
      [
        { id: "user-1", key: "user-1", order: 1, role: "user" },
        {
          id: "assistant-1",
          key: "assistant-1",
          order: 1,
          role: "assistant",
        },
        {
          id: "assistant-later",
          key: "assistant-later",
          order: 2,
          role: "assistant",
        },
      ],
      [snapshot]
    );

    expect(indexed.get("assistant-1")).toEqual(snapshot);
    expect(indexed.has("assistant-later")).toBe(false);
  });

  it("prefers the durable completion message over another assistant in the source turn", () => {
    const snapshot = {
      sessionId: "session-1" as never,
      mode: "first_workspace" as const,
      sourceMessageId: "user-1",
      assistantMessageId: "assistant-complete",
      generationRevision: 1,
      useCaseKey: "recruiting" as const,
      generatedProfiles: profiles,
      createdAt: 1,
    };
    const indexed = indexSetupProfileSnapshotsByAssistantMessage(
      [
        { id: "user-1", key: "user-1", order: 1, role: "user" },
        {
          id: "assistant-started",
          key: "assistant-started",
          order: 1,
          role: "assistant",
        },
        {
          id: "assistant-complete",
          key: "assistant-complete",
          order: 2,
          role: "assistant",
        },
      ],
      [snapshot]
    );

    expect(indexed.get("assistant-complete")).toEqual(snapshot);
    expect(indexed.has("assistant-started")).toBe(false);
  });
});
