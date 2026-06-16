import { defineNodeInstrumentation } from "evlog/next/instrumentation";
import {
  getLogEnvironmentContext,
  getLogServiceName,
} from "@/shared/lib/logging/config";

const environment = getLogEnvironmentContext();

export const { register, onRequestError } = defineNodeInstrumentation({
  service: getLogServiceName(),
  env: environment,
  pretty: environment.environment !== "production",
  stringify: true,
  minLevel: environment.environment === "production" ? "info" : "debug",
  captureOutput: false,
});
