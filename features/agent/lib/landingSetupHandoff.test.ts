import { describe, expect, it } from "vitest";
import {
  buildLandingSetupHandoffRequest,
  submitAuthenticatedLandingSetupHandoff,
  submitLandingSetupHandoffToThread,
} from "./landingSetupHandoff";

describe("landing setup handoff", () => {
  it("submits the stored description through the guarded setup surface", () => {
    const description =
      "Find React and Next.js developers looking to contribute to open source.";

    expect(
      buildLandingSetupHandoffRequest("thread_setup", {
        prompt: description,
        sourceUrl: null,
      })
    ).toEqual({
      threadId: "thread_setup",
      prompt: description,
      expectedSurface: "setup",
    });
  });

  it("forwards the original source URL without replacing the description", () => {
    expect(
      buildLandingSetupHandoffRequest("thread_setup", {
        prompt: "The extracted product and audience description",
        sourceUrl: "https://example.com/product",
      })
    ).toEqual({
      threadId: "thread_setup",
      prompt: "The extracted product and audience description",
      setupSourceUrl: "https://example.com/product",
      expectedSurface: "setup",
    });
  });

  it("submits exact multiline text to a selected fresh setup thread", async () => {
    const prompt =
      "  Find frontend developers.\n\nThey must love open source.  ";
    const submitted = await submitLandingSetupHandoffToThread({
      threadId: "thread_fresh",
      handoff: {
        prompt,
        sourceUrl: null,
        requiresNewWorkspaceDecision: true,
      },
      submitSetupMessage: async (request) => {
        expect(request.prompt).toBe(prompt);
        return { messageId: "message_fresh", order: 2 };
      },
    });

    expect(submitted).toEqual({
      prompt,
      sourceUrl: null,
      submittedTurn: {
        threadId: "thread_fresh",
        messageId: "message_fresh",
        order: 2,
      },
    });
  });

  it("durably submits before resolving the authenticated handoff", async () => {
    const events: string[] = [];
    let releaseSubmit: (() => void) | undefined;
    const submitGate = new Promise<void>((resolve) => {
      releaseSubmit = resolve;
    });
    const handoffPromise = submitAuthenticatedLandingSetupHandoff({
      handoff: {
        prompt: "Find open-source React contributors",
        sourceUrl: null,
      },
      mode: "new_workspace",
      startSetupSession: async (args) => {
        events.push(`start:${args.mode}`);
        return { threadId: "thread_durable" };
      },
      submitSetupMessage: async (args) => {
        events.push(`submit:${args.expectedSurface}:${args.prompt}`);
        await submitGate;
        return { messageId: "message_durable", order: 7 };
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual([
      "start:new_workspace",
      "submit:setup:Find open-source React contributors",
    ]);

    let resolved = false;
    void handoffPromise.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    releaseSubmit?.();
    await expect(handoffPromise).resolves.toEqual({
      threadId: "thread_durable",
      handoff: {
        prompt: "Find open-source React contributors",
        sourceUrl: null,
        submittedTurn: {
          threadId: "thread_durable",
          messageId: "message_durable",
          order: 7,
        },
      },
    });
  });
});
