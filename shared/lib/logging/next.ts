import { createEvlog } from "evlog/next";
import {
  compactLogContext,
  getDefaultLogRedactPaths,
  getLogDeploymentContext,
  getLogEnvironmentContext,
  getLogServiceName,
} from "./config";

const environment = getLogEnvironmentContext();

export const { withEvlog, useLogger, log, createEvlogError } = createEvlog({
  service: getLogServiceName(),
  env: environment,
  pretty: environment.environment !== "production",
  stringify: true,
  minLevel: environment.environment === "production" ? "info" : "debug",
  redact: {
    paths: getDefaultLogRedactPaths(),
  },
  keep: (ctx) => {
    if ((ctx.status ?? 0) >= 400 || (ctx.duration ?? 0) >= 1000) {
      ctx.shouldKeep = true;
    }
  },
  enrich: ({ event, request, response }) => {
    Object.assign(event, getLogDeploymentContext());

    Object.assign(
      event,
      compactLogContext({
        method: request?.method,
        path: request?.path,
        request_id: request?.requestId,
        status_code: response?.status,
      })
    );
  },
});
