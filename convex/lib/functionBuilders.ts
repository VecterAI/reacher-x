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
import {
  createConvexFunctionWideEventLogger,
  type ConvexFunctionKind,
} from "./wideEventLogger";
import { triggers } from "./triggers";

const withTriggerAwareDb = customCtx<MutationCtx, Pick<MutationCtx, "db">>(
  (ctx) => ({
    db: triggers.wrapDB(ctx).db,
  })
);

export const query = customQuery(rawQuery, NoOp);
export const internalQuery = customQuery(rawInternalQuery, NoOp);

type BuilderLike = (registration: any) => any;

function getRegistrationSource(): string | undefined {
  const stack = new Error().stack;
  if (!stack) {
    return undefined;
  }

  const cwd =
    typeof process !== "undefined" && typeof process.cwd === "function"
      ? process.cwd()
      : undefined;
  if (!cwd) {
    return undefined;
  }

  for (const rawLine of stack.split("\n")) {
    const line = rawLine.trim();
    if (
      !line.includes("/convex/") ||
      line.includes("/convex/lib/functionBuilders") ||
      line.includes("/convex/lib/wideEventLogger")
    ) {
      continue;
    }

    const absolutePathStart = line.indexOf(cwd);
    if (absolutePathStart === -1) {
      continue;
    }

    const source = line.slice(absolutePathStart).replace(/^file:\/\//, "");
    const match = source.match(/(.+?):(\d+):\d+$/);
    if (!match) {
      continue;
    }

    const relativePath = match[1].startsWith(`${cwd}/`)
      ? match[1].slice(cwd.length + 1)
      : match[1];

    return `${relativePath}:${match[2]}`;
  }

  return undefined;
}

function wrapFunctionBuilderWithWideEventLogging<TBuilder extends BuilderLike>(
  builder: TBuilder,
  kind: ConvexFunctionKind
): TBuilder {
  return ((registration: any) => {
    if (typeof registration === "function") {
      const source = getRegistrationSource();
      return builder(async (...handlerArgs: any[]) => {
        const [ctx, args] = handlerArgs;
        const logEvent = createConvexFunctionWideEventLogger({
          functionArgs: args,
          kind,
          source,
        });

        try {
          const result = await registration(
            {
              ...(ctx as unknown as Record<string, unknown>),
              logEvent,
            },
            ...handlerArgs.slice(1)
          );
          logEvent.emitSuccess(result);
          return result;
        } catch (error) {
          logEvent.emitError(error);
          throw error;
        }
      });
    }

    const { log: logMeta, handler, ...rest } = registration;
    if (typeof handler !== "function") {
      return builder(registration);
    }

    const source = getRegistrationSource();

    return builder({
      ...rest,
      handler: async (...handlerArgs: any[]) => {
        const [ctx, args] = handlerArgs;
        const logEvent = createConvexFunctionWideEventLogger({
          functionArgs: args,
          kind,
          meta: logMeta,
          source,
        });

        try {
          const result = await handler(
            {
              ...(ctx as unknown as Record<string, unknown>),
              logEvent,
            },
            args
          );
          logEvent.emitSuccess(result);
          return result;
        } catch (error) {
          logEvent.emitError(error);
          throw error;
        }
      },
    });
  }) as TBuilder;
}

// All public and internal mutations must flow through the shared wrapper so
// future trigger registrations stay consistent across the repo.
export const mutation = wrapFunctionBuilderWithWideEventLogging(
  customMutation(rawMutation, withTriggerAwareDb),
  "mutation"
);
export const internalMutation = wrapFunctionBuilderWithWideEventLogging(
  customMutation(rawInternalMutation, withTriggerAwareDb),
  "internalMutation"
);

export const action = wrapFunctionBuilderWithWideEventLogging(
  customAction(rawAction, NoOp),
  "action"
);
export const internalAction = wrapFunctionBuilderWithWideEventLogging(
  customAction(rawInternalAction, NoOp),
  "internalAction"
);

export { httpAction };
