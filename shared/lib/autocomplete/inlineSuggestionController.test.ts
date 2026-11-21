import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
  InlineAutocompleteRequest,
  InlineAutocompleteResponse,
} from "@/shared/lib/autocomplete/inlineAutocomplete";
import {
  getInlineSuggestionRemainder,
  getNextInlineSuggestionWord,
  InlineSuggestionController,
  type InlineSuggestionEventName,
} from "@/shared/lib/autocomplete/inlineSuggestionController";
import { isInlineSuggestionWordAcceptKey } from "@/shared/lib/autocomplete/inlineSuggestionKeys";

const DEBOUNCE_MS = 400;

type Deferred = {
  request: InlineAutocompleteRequest;
  resolve: (suggestion: string) => void;
  reject: () => void;
};

function response(suggestion: string): InlineAutocompleteResponse {
  return {
    suggestion,
    latencyMs: 120,
    model: "test-model",
    workspaceId: "ws_1",
    styleProfileApplied: false,
  };
}

function setup(options: { cacheSize?: number } = {}) {
  const calls: Deferred[] = [];
  const events: { name: InlineSuggestionEventName; props: any }[] = [];
  const cancelRemote = vi.fn();
  const controller = new InlineSuggestionController({
    debounceMs: DEBOUNCE_MS,
    cacheSize: options.cacheSize,
    fetchSuggestion: (request) =>
      new Promise((resolve, reject) => {
        calls.push({
          request,
          resolve: (suggestion) => resolve(response(suggestion)),
          reject: () => reject(new Error("failed")),
        });
      }),
    cancelRemote,
    onEvent: (name, props) => events.push({ name, props }),
  });
  return { controller, calls, events, cancelRemote };
}

function req(
  beforeCursor: string,
  extra: Partial<InlineAutocompleteRequest> = {}
): InlineAutocompleteRequest {
  return {
    surface: "composer",
    platform: "twitter",
    beforeCursor,
    afterCursor: "",
    ...extra,
  };
}

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

/** Types `text`, waits out the debounce and answers with `suggestion`. */
async function showSuggestion(
  ctx: ReturnType<typeof setup>,
  text: string,
  suggestion: string,
  extra: Partial<InlineAutocompleteRequest> = {}
) {
  ctx.controller.update(req(text, extra));
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
  ctx.calls.at(-1)!.resolve(suggestion);
  await settle();
}

const eventNames = (ctx: ReturnType<typeof setup>) =>
  ctx.events.map((event) => event.name);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("request lifecycle", () => {
  test("waits for the debounce, requests once and shows the ghost", async () => {
    const ctx = setup();
    ctx.controller.update(req("Thanks for the"));
    ctx.controller.update(req("Thanks for the q"));
    ctx.controller.update(req("Thanks for the"));

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    expect(ctx.calls).toHaveLength(0);
    expect(ctx.controller.getSnapshot().status).toBe("idle");

    await vi.advanceTimersByTimeAsync(1);
    expect(ctx.calls).toHaveLength(1);
    expect(ctx.calls[0].request.beforeCursor).toBe("Thanks for the");
    expect(ctx.controller.getSnapshot().status).toBe("requesting");

    ctx.calls[0].resolve("quick reply");
    await settle();

    const snapshot = ctx.controller.getSnapshot();
    expect(snapshot.status).toBe("showing");
    // Insertion text: the ghost carries the leading space the accept inserts.
    expect(snapshot.ghostText).toBe(" quick reply");
    expect(snapshot.announcement).toBe(
      "Suggestion: quick reply. Press Tab to accept."
    );
    expect(eventNames(ctx)).toEqual(["inline_autocomplete_shown"]);
    expect(ctx.events[0].props).toMatchObject({
      surface: "composer",
      platform: "twitter",
      suggestionLength: "quick reply".length,
      latencyMs: 120,
      model: "test-model",
    });
  });

  test("does not request for text the prefix rules reject", async () => {
    const ctx = setup();
    for (const text of ["short", "Check https://exa", "Ping me @"]) {
      ctx.controller.update(req(text));
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
      expect(ctx.calls, text).toHaveLength(0);
    }
  });

  test("an empty or failed response shows nothing", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "");
    expect(ctx.controller.getSnapshot().status).toBe("idle");

    ctx.controller.update(req("Thanks for the note"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    ctx.calls.at(-1)!.reject();
    await settle();
    expect(ctx.controller.getSnapshot().status).toBe("idle");
    expect(ctx.events).toHaveLength(0);
  });

  test("runs one request at a time and then asks for the latest text", async () => {
    const ctx = setup();
    ctx.controller.update(req("Thanks for the"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(ctx.calls).toHaveLength(1);

    ctx.controller.update(req("Hello there, how"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(ctx.calls).toHaveLength(1);

    // The first answer no longer fits the text, so it is dropped and the
    // queued request for the latest text starts.
    ctx.calls[0].resolve("quick reply");
    await settle();
    expect(ctx.calls).toHaveLength(2);
    expect(ctx.calls[1].request.beforeCursor).toBe("Hello there, how");
    expect(ctx.controller.getSnapshot().ghostText).toBe("");

    ctx.calls[1].resolve("are you");
    await settle();
    expect(ctx.controller.getSnapshot().ghostText).toBe(" are you");
  });

  test("a cached answer reached while a request is queued stays acceptable", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");

    // Request A runs; while it runs, the debounce for later text expires and
    // queues another request.
    ctx.controller.update(req("Hello there, how"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    ctx.controller.update(req("Hello there, how are"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(ctx.calls).toHaveLength(2);

    // Back to text with a cached answer: it shows, and the queued request
    // must not replace it with a "requesting" state when A settles.
    ctx.controller.update(req("Thanks for the"));
    ctx.calls[1].resolve("you doing");
    await settle();

    expect(ctx.calls).toHaveLength(2);
    expect(ctx.controller.getSnapshot()).toMatchObject({
      status: "showing",
      ghostText: " quick reply",
    });
    expect(ctx.controller.acceptAll()).toBe(" quick reply");
  });

  test("a late answer still shows when the user typed a prefix of it", async () => {
    const ctx = setup();
    ctx.controller.update(req("Thanks for the"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    ctx.controller.update(req("Thanks for the q"));

    ctx.calls[0].resolve("quick reply");
    await settle();

    expect(ctx.controller.getSnapshot().ghostText).toBe("uick reply");
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(ctx.calls).toHaveLength(1);
  });
});

describe("prefix reuse", () => {
  test("typing into the suggestion trims the ghost without a new request", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");

    ctx.controller.update(req("Thanks for the "));
    expect(ctx.controller.getSnapshot().ghostText).toBe("quick reply");
    ctx.controller.update(req("Thanks for the qui"));
    expect(ctx.controller.getSnapshot().ghostText).toBe("ck reply");

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(ctx.calls).toHaveLength(1);
    // Still the same suggestion: no second "shown" event, same announcement.
    expect(eventNames(ctx)).toEqual(["inline_autocomplete_shown"]);
    expect(ctx.controller.getSnapshot().announcement).toBe(
      "Suggestion: quick reply. Press Tab to accept."
    );
  });

  test("backspacing toward the anchor grows the ghost back", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");
    ctx.controller.update(req("Thanks for the qui"));
    ctx.controller.update(req("Thanks for the q"));
    expect(ctx.controller.getSnapshot().ghostText).toBe("uick reply");
  });

  test("typing the whole suggestion clears it without a dismiss event", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");
    ctx.controller.update(req("Thanks for the quick reply"));

    expect(ctx.controller.getSnapshot().status).toBe("idle");
    expect(eventNames(ctx)).toEqual(["inline_autocomplete_shown"]);
  });

  test("another prospect is not reused", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply", {
      prospectId: "p1",
    });
    ctx.controller.update(req("Thanks for the q", { prospectId: "p2" }));
    expect(ctx.controller.getSnapshot().ghostText).toBe("");
  });

  test("different text after the caret is not reused", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply", {
      prospectId: "p1",
      afterCursor: "",
    });
    ctx.controller.update(
      req("Thanks for the q", { prospectId: "p1", afterCursor: " today" })
    );
    expect(ctx.controller.getSnapshot().ghostText).toBe("");
    expect(ctx.events.at(-1)?.props.reason).toBe("input_changed");
  });

  test("reuses a cached answer when the text returns to an earlier prefix", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");
    ctx.controller.update(req("Thanks for thx"));
    expect(ctx.controller.getSnapshot().ghostText).toBe("");

    ctx.controller.update(req("Thanks for the"));
    expect(ctx.controller.getSnapshot().ghostText).toBe(" quick reply");
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(ctx.calls).toHaveLength(1);
  });

  test("the response cache is bounded", async () => {
    const ctx = setup({ cacheSize: 2 });
    await showSuggestion(ctx, "First message here", "one");
    await showSuggestion(ctx, "Second message here", "two");
    await showSuggestion(ctx, "Third message here", "three");
    expect(ctx.controller.getCacheSize()).toBe(2);

    // The oldest entry was evicted, so the first prefix is requested again.
    ctx.controller.update(req("First message here"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(ctx.calls).toHaveLength(4);
  });
});

describe("dismiss", () => {
  test("a divergent edit dismisses with input_changed and requests again", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");
    ctx.controller.update(req("Thanks for the x"));

    expect(ctx.controller.getSnapshot().status).toBe("idle");
    expect(ctx.events.at(-1)).toMatchObject({
      name: "inline_autocomplete_dismissed",
      props: { reason: "input_changed" },
    });
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(ctx.calls).toHaveLength(2);
  });

  test("moving the caret dismisses with selection_changed", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");
    ctx.controller.update(req("Thanks for", { afterCursor: " the" }));
    expect(ctx.events.at(-1)?.props.reason).toBe("selection_changed");
  });

  test("a selection or lost caret dismisses with selection_changed", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");
    ctx.controller.update(null);
    expect(ctx.events.at(-1)?.props.reason).toBe("selection_changed");
  });

  test("Escape dismisses and the same text is not requested again", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");
    ctx.controller.dismiss("escape");

    expect(ctx.controller.getSnapshot().status).toBe("idle");
    expect(ctx.events.at(-1)?.props.reason).toBe("escape");

    // Caret leaves and comes back: no refetch, no cached re-show.
    ctx.controller.update(null);
    ctx.controller.update(req("Thanks for the"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(ctx.calls).toHaveLength(1);
    expect(ctx.controller.getSnapshot().ghostText).toBe("");

    // New text asks again.
    ctx.controller.update(req("Thanks for the h"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(ctx.calls).toHaveLength(2);
  });

  test("the Escape hold ends once the text changes", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");
    ctx.controller.dismiss("escape");

    ctx.controller.update(req("Thanks for thex"));
    ctx.controller.update(req("Thanks for the"));
    expect(ctx.controller.getSnapshot().ghostText).toBe(" quick reply");
  });

  test("hasPendingSuggestion covers debounce, request and ghost", async () => {
    const ctx = setup();
    expect(ctx.controller.hasPendingSuggestion()).toBe(false);
    ctx.controller.update(req("Thanks for the"));
    expect(ctx.controller.hasPendingSuggestion()).toBe(true);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(ctx.controller.hasPendingSuggestion()).toBe(true);
    ctx.controller.dismiss("escape");
    expect(ctx.controller.hasPendingSuggestion()).toBe(false);
  });

  test("disabling (IME composition, read-only) dismisses with disabled", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");
    ctx.controller.setEnabled(false);
    expect(ctx.events.at(-1)?.props.reason).toBe("disabled");

    // Updates while disabled never request.
    ctx.controller.update(req("Thanks for the note"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
    expect(ctx.calls).toHaveLength(1);

    // Re-enabling picks up the latest text.
    ctx.controller.setEnabled(true);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(ctx.calls).toHaveLength(2);
    expect(ctx.calls[1].request.beforeCursor).toBe("Thanks for the note");
  });
});

describe("cancellation", () => {
  test("keystrokes never call the server cancel; stale answers are dropped locally", async () => {
    const ctx = setup();
    const thread = { threadId: "thread_1" };
    ctx.controller.update(req("Thanks for the", thread));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    for (const text of ["Thanks for thx", "Thanks for th", "Thanks for t"]) {
      ctx.controller.update(req(text, thread));
    }
    ctx.calls[0].resolve("quick reply");
    await settle();

    expect(ctx.cancelRemote).not.toHaveBeenCalled();
    expect(ctx.controller.getSnapshot().ghostText).toBe("");
  });

  test("Escape or blur during a thread request cancels it on the server", async () => {
    const ctx = setup();
    ctx.controller.update(req("Thanks for the", { threadId: "thread_1" }));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    ctx.controller.dismiss("blur");

    expect(ctx.cancelRemote).toHaveBeenCalledTimes(1);
    expect(ctx.cancelRemote.mock.calls[0][0].threadId).toBe("thread_1");

    // The canceled request's answer is ignored.
    ctx.calls[0].resolve("quick reply");
    await settle();
    expect(ctx.controller.getSnapshot().status).toBe("idle");
  });

  test("a thread request outlived by a disable is still canceled on teardown", async () => {
    const ctx = setup();
    ctx.controller.update(req("Thanks for the", { threadId: "thread_1" }));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    ctx.controller.setEnabled(false);
    expect(ctx.cancelRemote).not.toHaveBeenCalled();

    ctx.controller.dispose();
    expect(ctx.cancelRemote).toHaveBeenCalledTimes(1);

    // Once the server answered, there is nothing left to cancel.
    const settled = setup();
    settled.controller.update(req("Thanks for the", { threadId: "thread_1" }));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    settled.controller.setEnabled(false);
    settled.calls[0].resolve("quick reply");
    await settle();
    settled.controller.dispose();
    expect(settled.cancelRemote).not.toHaveBeenCalled();
  });

  test("no server cancel without a thread helper or without a request in flight", async () => {
    const ctx = setup();
    ctx.controller.update(req("Thanks for the"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    ctx.controller.dismiss("escape");

    await showSuggestion(ctx, "Thanks for the note", "here", {
      threadId: "thread_1",
    });
    ctx.controller.dismiss("escape");
    expect(ctx.cancelRemote).not.toHaveBeenCalled();
  });
});

describe("accept", () => {
  test("Tab accepts the remaining suggestion", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply");
    ctx.controller.update(req("Thanks for the qu"));

    expect(ctx.controller.acceptAll()).toBe("ick reply");
    expect(ctx.controller.getSnapshot().status).toBe("idle");
    expect(ctx.events.at(-1)).toMatchObject({
      name: "inline_autocomplete_accepted",
      props: { acceptedLength: "ick reply".length, model: "test-model" },
    });
    expect(ctx.controller.acceptAll()).toBe("");
  });

  test("word-by-word accept inserts one word at a time", async () => {
    const ctx = setup();
    await showSuggestion(ctx, "Thanks for the", "quick reply, Sam");

    expect(ctx.controller.acceptNextWord()).toBe(" quick");
    expect(ctx.events.at(-1)).toMatchObject({
      name: "inline_autocomplete_partial_accept",
      props: { acceptedLength: 6, remainingLength: " reply, Sam".length },
    });
    // The surface inserts the word; the next caret report trims the ghost.
    ctx.controller.update(req("Thanks for the quick"));
    expect(ctx.controller.getSnapshot().ghostText).toBe(" reply, Sam");

    expect(ctx.controller.acceptNextWord()).toBe(" reply,");
    ctx.controller.update(req("Thanks for the quick reply,"));

    // The last word completes the suggestion and counts as accepted.
    expect(ctx.controller.acceptNextWord()).toBe(" Sam");
    expect(ctx.events.at(-1)?.name).toBe("inline_autocomplete_accepted");
    expect(ctx.controller.getSnapshot().status).toBe("idle");
    expect(
      eventNames(ctx).filter((name) => name === "inline_autocomplete_shown")
    ).toHaveLength(1);
  });

  test("nothing to accept while idle or requesting", async () => {
    const ctx = setup();
    expect(ctx.controller.acceptAll()).toBe("");
    ctx.controller.update(req("Thanks for the"));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(ctx.controller.acceptNextWord()).toBe("");
  });
});

describe("helpers", () => {
  test("getNextInlineSuggestionWord takes leading space plus one word", () => {
    expect(getNextInlineSuggestionWord(" quick reply")).toBe(" quick");
    expect(getNextInlineSuggestionWord("uick reply")).toBe("uick");
    expect(getNextInlineSuggestionWord(", thanks")).toBe(",");
    expect(getNextInlineSuggestionWord("done")).toBe("done");
    expect(getNextInlineSuggestionWord("")).toBe("");
  });

  test("getInlineSuggestionRemainder", () => {
    const base = { insertion: " quick reply", anchorBeforeCursor: "Hi the" };
    expect(
      getInlineSuggestionRemainder({ ...base, beforeCursor: "Hi the qu" })
    ).toBe("ick reply");
    expect(
      getInlineSuggestionRemainder({ ...base, beforeCursor: "Hi the x" })
    ).toBeNull();
    expect(
      getInlineSuggestionRemainder({ ...base, beforeCursor: "Hi th" })
    ).toBeNull();
    expect(
      getInlineSuggestionRemainder({
        ...base,
        beforeCursor: "Hi the quick reply",
      })
    ).toBe("");
  });

  test("word accept key is Ctrl/Cmd+Right only", () => {
    const key = {
      key: "ArrowRight",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    };
    expect(isInlineSuggestionWordAcceptKey({ ...key, ctrlKey: true })).toBe(
      true
    );
    expect(isInlineSuggestionWordAcceptKey({ ...key, metaKey: true })).toBe(
      true
    );
    expect(isInlineSuggestionWordAcceptKey(key)).toBe(false);
    expect(
      isInlineSuggestionWordAcceptKey({ ...key, ctrlKey: true, shiftKey: true })
    ).toBe(false);
    expect(
      isInlineSuggestionWordAcceptKey({ ...key, ctrlKey: true, altKey: true })
    ).toBe(false);
    expect(
      isInlineSuggestionWordAcceptKey({
        ...key,
        key: "ArrowLeft",
        ctrlKey: true,
      })
    ).toBe(false);
  });
});
