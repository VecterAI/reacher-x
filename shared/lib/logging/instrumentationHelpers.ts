import { createInstrumentation } from "evlog/next/instrumentation/create";
import { getLogEnvironmentContext, getLogServiceName } from "./config";

const environment = getLogEnvironmentContext();

export const { register, onRequestError } = createInstrumentation({
  service: getLogServiceName(),
  env: environment,
  pretty: environment.environment !== "production",
  stringify: true,
  minLevel: environment.environment === "production" ? "info" : "debug",
  captureOutput: false,
});
