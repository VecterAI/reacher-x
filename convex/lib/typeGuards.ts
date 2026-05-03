/**
 * Type Guards
 *
 * Runtime type checking utilities to prevent unsafe casts.
 * Per AGENT_CONTEXT.txt: Use runtime type guards instead of unsafe `as` casts.
 */

/**
 * Check if a value is a non-null object (Record-like).
 * Use this instead of `value as Record<string, unknown>`.
 *
 * @example
 * ```ts
 * // BAD - Unsafe cast
 * const user = prospect.data.user as Record<string, unknown>;
 *
 * // GOOD - Runtime guard
 * const user = isRecord(prospect.data?.user) ? prospect.data.user : undefined;
 * ```
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Safely extract a nested record from an object.
 * Returns undefined if the path doesn't exist or isn't a record.
 *
 * @example
 * ```ts
 * const user = getNestedRecord(prospectData, "user");
 * if (user) {
 *   const screenName = user.screen_name;
 * }
 * ```
 */
export function getNestedRecord(
  obj: unknown,
  key: string
): Record<string, unknown> | undefined {
  if (!isRecord(obj)) return undefined;
  const value = obj[key];
  return isRecord(value) ? value : undefined;
}

/**
 * Safely extract a string from an object.
 * Returns undefined if the key doesn't exist or isn't a string.
 */
export function getStringProperty(
  obj: unknown,
  key: string
): string | undefined {
  if (!isRecord(obj)) return undefined;
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Safely extract a number from an object.
 * Returns undefined if the key doesn't exist or isn't a number.
 */
export function getNumberProperty(
  obj: unknown,
  key: string
): number | undefined {
  if (!isRecord(obj)) return undefined;
  const value = obj[key];
  return typeof value === "number" ? value : undefined;
}
