import { describe, expect, test } from "vitest";
import {
  buildRecentAutocompleteMessages,
  clampInlineAutocompleteSuggestion,
  INLINE_AUTOCOMPLETE_MAX_RECENT_MESSAGES,
  normalizeInlineAutocompleteSuggestion,
} from "@/shared/lib/autocomplete/inlineAutocomplete";

describe("buildRecentAutocompleteMessages", () => {
  test("drops empty entries, normalizes whitespace, truncates long turns, and caps to most recent messages", () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("prospect" as const),
      author: index % 2 === 0 ? null : "  Maya   Chen ",
      text:
        index === 7
          ? `  ${"word ".repeat(80)}`
          : `  Message   ${index + 1}\nwith newline `,
    }));

    const result = buildRecentAutocompleteMessages([
      ...messages,
      { role: "assistant", text: "   \n\t  " },
    ]);

    expect(result).toHaveLength(INLINE_AUTOCOMPLETE_MAX_RECENT_MESSAGES);
    expect(result[0]).toEqual({
      role: "user",
      text: "Message 3 with newline",
    });
    expect(result[1]).toEqual({
      role: "prospect",
      author: "Maya Chen",
      text: "Message 4 with newline",
    });
    expect(result.at(-1)?.text.length).toBeLessThanOrEqual(280);
    expect(result.at(-1)?.text.endsWith("…")).toBe(true);
  });
});

describe("clampInlineAutocompleteSuggestion", () => {
  test("allows natural clause-length continuations and preserves leading space", () => {
    const normalized = normalizeInlineAutocompleteSuggestion({
      beforeCursor: "100% this. Most solo founders just want",
      suggestion: "a simple way to track conversations without the bloat",
    });

    const clamped = clampInlineAutocompleteSuggestion({
      suggestion: normalized,
      beforeCursor: "100% this. Most solo founders just want",
    });

    expect(clamped).toBe(
      " a simple way to track conversations without the bloat"
    );
  });

  test("respects x_post weighted budget strictly", () => {
    const beforeCursor =
      "Nothing makes me close a tab faster than seeing 'Book a Demo' for a simple tool. If I have to sit through a 30-minute discovery call just to find out it costs $49/mo, I'm already looking for an open-source alternative or ";

    const clamped = clampInlineAutocompleteSuggestion({
      suggestion:
        "building a quick internal script over the weekend instead of waiting for a sales rep",
      beforeCursor,
      maxLength: 280,
      characterCountMode: "x_post",
    });

    expect(clamped.length).toBeGreaterThan(0);
    expect(`${beforeCursor}${clamped}`.length).toBeLessThanOrEqual(280);
  });
});
