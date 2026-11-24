"use client";

import * as React from "react";

import { loadHighlighter } from "@/shared/ui/lib/highlighter";

type LoadedHighlighter = Awaited<ReturnType<typeof loadHighlighter>>;
type HighlighterGrammarState = Parameters<
  NonNullable<LoadedHighlighter>["highlight"]
>[1];

/**
 * Incrementally highlights streaming or static code into per-line React nodes.
 * Complete lines are cached as they arrive so streaming only tokenizes new lines.
 */
export function useHighlightedCode(value: string, language: string) {
  // A trailing newline would otherwise render as an extra blank line.
  const code = value.endsWith("\n") ? value.slice(0, -1) : value;
  const [loaded, setLoaded] = React.useState<{
    language: string;
    highlighter: LoadedHighlighter;
  } | null>(null);
  const highlighter = loaded?.language === language ? loaded.highlighter : null;

  React.useEffect(() => {
    let cancelled = false;

    loadHighlighter(language)
      .then((next) => {
        if (!cancelled) {
          setLoaded({ language, highlighter: next });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [language]);

  const [done, setDone] = React.useState<{
    highlighter: LoadedHighlighter;
    text: string;
    lines: React.ReactNode[];
    state?: HighlighterGrammarState;
  }>({ highlighter: null, text: "", lines: [] });

  let next = done;

  if (next.highlighter !== highlighter || !code.startsWith(next.text)) {
    next = { highlighter, text: "", lines: [] };
  }

  const end = code.lastIndexOf("\n") + 1;

  if (highlighter && end > next.text.length) {
    const result = highlighter.highlight(
      code.slice(next.text.length, end - 1),
      next.state
    );

    next = {
      highlighter,
      text: code.slice(0, end),
      lines: [...next.lines, ...result.lines],
      state: result.state,
    };
  }

  if (next !== done) {
    setDone(next);
  }

  const tail = code.slice(end);

  return React.useMemo(() => {
    if (!highlighter) {
      return code.split("\n");
    }

    return [...next.lines, highlighter.highlight(tail, next.state).lines[0]];
  }, [code, highlighter, next, tail]);
}
