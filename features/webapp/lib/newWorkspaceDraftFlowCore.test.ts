import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  replaceWorkspaceDraft,
  runControlledDraftDialogAction,
} from "./newWorkspaceDraftFlowCore";

describe("new workspace draft flow", () => {
  it("keeps the landing handoff alive through the discard action lifecycle", async () => {
    const modalSource = readFileSync(
      new URL("../ui/components/NewWorkspaceDraftModal.tsx", import.meta.url),
      "utf8"
    );
    expect(modalSource.match(/runControlledDraftDialogAction/g)).toHaveLength(
      3
    );

    const events: string[] = [];
    let pendingDescription: string | null = "Find open-source developers";
    let defaultPrevented = false;
    let releaseDiscard: (() => void) | undefined;
    let replacement: Promise<void> | undefined;
    const discardGate = new Promise<void>((resolve) => {
      releaseDiscard = resolve;
    });
    const onCancel = vi.fn(() => {
      pendingDescription = null;
      events.push("cancel");
    });

    runControlledDraftDialogAction(
      {
        preventDefault: () => {
          defaultPrevented = true;
        },
      },
      () => {
        replacement = replaceWorkspaceDraft({
          sessionId: "session_existing",
          mode: "new_workspace",
          discardSetupSession: async () => {
            events.push("discard:start");
            await discardGate;
            events.push("discard:complete");
          },
          startSetupSession: async () => {
            events.push("start:fresh");
            return { threadId: "thread_fresh" };
          },
          selectSession: async (selection) => {
            events.push(`select:${selection.threadId}`);
            expect(pendingDescription).toBe("Find open-source developers");
          },
        });
      }
    );

    // This models Radix AlertDialogAction: without preventDefault, its
    // implicit close would invoke the controlled dialog's cancel callback.
    if (!defaultPrevented) {
      onCancel();
    }

    expect(defaultPrevented).toBe(true);
    expect(events).toEqual(["discard:start"]);
    expect(onCancel).not.toHaveBeenCalled();
    releaseDiscard?.();
    await replacement;
    expect(events).toEqual([
      "discard:start",
      "discard:complete",
      "start:fresh",
      "select:thread_fresh",
    ]);
    expect(pendingDescription).toBe("Find open-source developers");
  });

  it("prevents implicit close for Continue while explicit Cancel still cancels", () => {
    let defaultPrevented = false;
    const onCancel = vi.fn();
    const onContinue = vi.fn();

    runControlledDraftDialogAction(
      {
        preventDefault: () => {
          defaultPrevented = true;
        },
      },
      onContinue
    );
    if (!defaultPrevented) {
      onCancel();
    }

    expect(onContinue).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    onCancel();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
