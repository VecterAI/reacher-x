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
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as keywordSuggestions from "../keywordSuggestions.js";
import type * as lib_llmConfig from "../lib/llmConfig.js";
import type * as llmFilter from "../llmFilter.js";
import type * as sendEmail from "../sendEmail.js";
import type * as socialAccounts from "../socialAccounts.js";
import type * as socialdata from "../socialdata.js";
import type * as twitterSearch from "../twitterSearch.js";
import type * as validators from "../validators.js";
import type * as waitlist from "../waitlist.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  http: typeof http;
  keywordSuggestions: typeof keywordSuggestions;
  "lib/llmConfig": typeof lib_llmConfig;
  llmFilter: typeof llmFilter;
  sendEmail: typeof sendEmail;
  socialAccounts: typeof socialAccounts;
  socialdata: typeof socialdata;
  twitterSearch: typeof twitterSearch;
  validators: typeof validators;
  waitlist: typeof waitlist;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
