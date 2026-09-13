import type { PaginationOptions } from "convex/server";

export function paginateLocalRows<T>(
  rows: readonly T[],
  options: PaginationOptions
) {
  const offset = Number(options.cursor ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new Error("Invalid pagination cursor");
  if (!Number.isSafeInteger(options.numItems) || options.numItems < 1)
    throw new Error("Invalid page size");
  const end = offset + options.numItems;
  return {
    page: rows.slice(offset, end),
    continueCursor: String(end),
    isDone: end >= rows.length,
  };
}
