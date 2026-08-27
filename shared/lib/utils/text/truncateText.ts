/**
 * Truncate text to a UTF-16 code-unit budget without splitting a surrogate
 * pair. The returned value never exceeds maxLength and uses one character for
 * the ellipsis when truncation is required.
 */
export function truncateText(value: string, maxLength = 280): string {
  const trimmed = value.trim();
  const boundedMaxLength = Math.max(0, Math.floor(maxLength));

  if (trimmed.length <= boundedMaxLength) {
    return trimmed;
  }
  if (boundedMaxLength === 0) {
    return "";
  }

  const prefixLength = boundedMaxLength - 1;
  const lastPrefixCodeUnit = trimmed.charCodeAt(prefixLength - 1);
  const safePrefixLength =
    lastPrefixCodeUnit >= 0xd800 && lastPrefixCodeUnit <= 0xdbff
      ? prefixLength - 1
      : prefixLength;

  return `${trimmed.slice(0, safePrefixLength).trimEnd()}…`;
}
