/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as cron from "../cron.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as keywordRePrompt from "../keywordRePrompt.js";
import type * as keywordSuggestions from "../keywordSuggestions.js";
import type * as lib_llmConfig from "../lib/llmConfig.js";
import type * as lib_types from "../lib/types.js";
import type * as llmFilter from "../llmFilter.js";
import type * as sendEmail from "../sendEmail.js";
import type * as socialAccounts from "../socialAccounts.js";
import type * as socialdata from "../socialdata.js";
import type * as twitterSearch from "../twitterSearch.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as waitlist from "../waitlist.js";
import type * as workosActions from "../workosActions.js";
import type * as workosCron from "../workosCron.js";
import type * as workosEventProcessor from "../workosEventProcessor.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  cron: typeof cron;
  events: typeof events;
  http: typeof http;
  keywordRePrompt: typeof keywordRePrompt;
  keywordSuggestions: typeof keywordSuggestions;
  "lib/llmConfig": typeof lib_llmConfig;
  "lib/types": typeof lib_types;
  llmFilter: typeof llmFilter;
  sendEmail: typeof sendEmail;
  socialAccounts: typeof socialAccounts;
  socialdata: typeof socialdata;
  twitterSearch: typeof twitterSearch;
  users: typeof users;
  validators: typeof validators;
  waitlist: typeof waitlist;
  workosActions: typeof workosActions;
  workosCron: typeof workosCron;
  workosEventProcessor: typeof workosEventProcessor;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
