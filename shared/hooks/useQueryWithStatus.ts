import { makeUseQueryWithStatus } from "convex-helpers/react";
import { useQueries } from "convex/react";

/**
 * Project-wide Convex query hook that exposes explicit pending/error states
 * instead of relying on `undefined` values and thrown query errors.
 */
export const useQueryWithStatus = makeUseQueryWithStatus(useQueries);
