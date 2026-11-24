type KeyLike = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

/**
 * Word-by-word accept: Ctrl+Right (Windows/Linux) or Cmd+Right (macOS), the
 * VS Code / Cursor binding. Only claimed while a suggestion is showing, so the
 * usual "jump a word / to line end" behavior is untouched otherwise.
 */
export function isInlineSuggestionWordAcceptKey(event: KeyLike): boolean {
  return (
    event.key === "ArrowRight" &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}
