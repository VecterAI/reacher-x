const TERMINAL_LANGUAGES = new Set([
  "bash",
  "console",
  "sh",
  "shell",
  "shellscript",
  "terminal",
  "zsh",
]);

const PLAIN_TEXT_LANGUAGES = new Set(["", "plain", "plaintext", "text", "txt"]);

const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  css: "CSS",
  diff: "Diff",
  html: "HTML",
  javascript: "JavaScript",
  js: "JavaScript",
  json: "JSON",
  jsonc: "JSON",
  jsx: "JSX",
  markdown: "Markdown",
  md: "Markdown",
  mdx: "MDX",
  py: "Python",
  python: "Python",
  sql: "SQL",
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
  yaml: "YAML",
  yml: "YAML",
};

export type CodeBlockIconKind = "terminal" | "file" | "code";

export interface CodeBlockMeta {
  title: string | null;
  icon: CodeBlockIconKind;
}

/**
 * Resolves a human-friendly header title and icon kind for a fenced code block.
 * Shell blocks default to "Terminal" with a terminal icon, named snippets keep
 * their filename, and plain text blocks without a filename omit the header.
 */
export function getCodeBlockMeta(
  language?: string,
  filename?: string
): CodeBlockMeta {
  const normalizedLanguage = (language ?? "").trim().toLowerCase();
  const trimmedFilename = filename?.trim() || null;

  if (TERMINAL_LANGUAGES.has(normalizedLanguage)) {
    return {
      title: trimmedFilename ?? "Terminal",
      icon: "terminal",
    };
  }

  if (trimmedFilename) {
    return {
      title: trimmedFilename,
      icon: trimmedFilename.toLowerCase() === "terminal" ? "terminal" : "file",
    };
  }

  if (PLAIN_TEXT_LANGUAGES.has(normalizedLanguage)) {
    return {
      title: null,
      icon: "file",
    };
  }

  return {
    title: Object.hasOwn(LANGUAGE_DISPLAY_NAMES, normalizedLanguage)
      ? LANGUAGE_DISPLAY_NAMES[normalizedLanguage]
      : normalizedLanguage,
    icon: "code",
  };
}
