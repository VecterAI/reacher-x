import * as React from "react";
import {
  createHighlighterCore,
  type GrammarState,
  type HighlighterCore,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { neutralShikiThemes } from "@/shared/ui/components/shikiNeutralTheme";

// Lazy-loaded language grammars; each loads the first time it is requested.
const languages = {
  bash: () => import("shiki/langs/shellscript.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
} as const;

type SupportedLanguage = keyof typeof languages;

const aliases: Record<string, SupportedLanguage> = {
  js: "javascript",
  jsonc: "json",
  md: "markdown",
  mdx: "markdown",
  py: "python",
  sh: "bash",
  shell: "bash",
  shellscript: "bash",
  ts: "typescript",
  yml: "yaml",
  zsh: "bash",
};

const TOKEN_STYLE_CLASS_NAME =
  "text-(--shiki-light) [font-style:var(--shiki-light-font-style)] [font-weight:var(--shiki-light-font-weight)] [text-decoration:var(--shiki-light-text-decoration)] dark:text-(--shiki-dark) dark:[font-style:var(--shiki-dark-font-style)] dark:[font-weight:var(--shiki-dark-font-weight)] dark:[text-decoration:var(--shiki-dark-text-decoration)]";

let highlighterPromise: Promise<HighlighterCore> | undefined;

function getHighlighter() {
  highlighterPromise ??= createHighlighterCore({
    themes: [neutralShikiThemes.light, neutralShikiThemes.dark],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });

  return highlighterPromise;
}

function resolveLanguage(language: string): SupportedLanguage | "ansi" | null {
  const normalized = language.trim().toLowerCase();

  if (normalized === "ansi") {
    return normalized;
  }

  if (normalized in languages) {
    return normalized as SupportedLanguage;
  }

  return aliases[normalized] ?? null;
}

/**
 * Loads a Shiki grammar on demand using the JS regex engine (no WASM) and
 * returns a stateful line highlighter themed with our neutral monochrome palette.
 */
export async function loadHighlighter(language: string) {
  const lang = resolveLanguage(language);

  if (!lang) {
    return null;
  }

  const shiki = await getHighlighter();

  if (lang !== "ansi" && !shiki.getLoadedLanguages().includes(lang)) {
    await shiki.loadLanguage(languages[lang]);
  }

  return {
    highlight(code: string, state?: GrammarState) {
      const tokenize = (text: string) =>
        shiki.codeToTokens(text, {
          lang,
          themes: { light: "neutral-light", dark: "neutral-dark" },
          defaultColor: false,
          grammarState: state,
        }).tokens;

      // ANSI has no cross-line grammar state, so each line tokenizes independently.
      const tokens =
        lang === "ansi"
          ? code.split("\n").flatMap((line) => tokenize(line))
          : tokenize(code);

      return {
        lines: tokens.map((line) =>
          line.map((token, index) => (
            <span
              key={index}
              style={token.htmlStyle as React.CSSProperties}
              className={TOKEN_STYLE_CLASS_NAME}
            >
              {token.content}
            </span>
          ))
        ),
        state: shiki.getLastGrammarState(tokens),
      };
    },
  };
}

/**
 * Highlights a full code snippet into per-line React nodes, or returns null
 * when the language is plain text / unsupported.
 */
export async function highlightCode(code: string, language: string) {
  const highlighter = await loadHighlighter(language);

  return highlighter ? highlighter.highlight(code).lines : null;
}
