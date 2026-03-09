import {
  action as rawAction,
  httpAction,
  internalAction as rawInternalAction,
  internalMutation as rawInternalMutation,
  internalQuery as rawInternalQuery,
  mutation as rawMutation,
  query as rawQuery,
} from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
  NoOp,
} from "convex-helpers/server/customFunctions";
import { triggers } from "./triggers";

const withTriggerAwareDb = customCtx<MutationCtx, Pick<MutationCtx, "db">>(
  (ctx) => ({
    db: triggers.wrapDB(ctx).db,
  })
);

export const query = customQuery(rawQuery, NoOp);
export const internalQuery = customQuery(rawInternalQuery, NoOp);

// All public and internal mutations must flow through the shared wrapper so
// future trigger registrations stay consistent across the repo.
export const mutation = customMutation(rawMutation, withTriggerAwareDb);
export const internalMutation = customMutation(
  rawInternalMutation,
  withTriggerAwareDb
);

export const action = customAction(rawAction, NoOp);
export const internalAction = customAction(rawInternalAction, NoOp);

export { httpAction };
