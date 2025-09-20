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
import type * as cryptoActions from "../cryptoActions.js";
import type * as http from "../http.js";
import type * as keywordMigration from "../keywordMigration.js";
import type * as keywordRePrompt from "../keywordRePrompt.js";
import type * as keywordSuggestions from "../keywordSuggestions.js";
import type * as keywords from "../keywords.js";
import type * as lib_llmConfig from "../lib/llmConfig.js";
import type * as lib_notificationHelpers from "../lib/notificationHelpers.js";
import type * as lib_userUtils from "../lib/userUtils.js";
import type * as llmFilter from "../llmFilter.js";
import type * as mediaUpload from "../mediaUpload.js";
import type * as mediaUploadMutations from "../mediaUploadMutations.js";
import type * as notifications from "../notifications.js";
import type * as replyQueue from "../replyQueue.js";
import type * as replyQueueMutations from "../replyQueueMutations.js";
import type * as sendEmail from "../sendEmail.js";
import type * as socialAccounts from "../socialAccounts.js";
import type * as socialAccountsMutations from "../socialAccountsMutations.js";
import type * as socialdata from "../socialdata.js";
import type * as socialdataMutations from "../socialdataMutations.js";
import type * as twitterClient from "../twitterClient.js";
import type * as twitterSearch from "../twitterSearch.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as waitlist from "../waitlist.js";
import type * as workspaces from "../workspaces.js";

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
  cryptoActions: typeof cryptoActions;
  http: typeof http;
  keywordMigration: typeof keywordMigration;
  keywordRePrompt: typeof keywordRePrompt;
  keywordSuggestions: typeof keywordSuggestions;
  keywords: typeof keywords;
  "lib/llmConfig": typeof lib_llmConfig;
  "lib/notificationHelpers": typeof lib_notificationHelpers;
  "lib/userUtils": typeof lib_userUtils;
  llmFilter: typeof llmFilter;
  mediaUpload: typeof mediaUpload;
  mediaUploadMutations: typeof mediaUploadMutations;
  notifications: typeof notifications;
  replyQueue: typeof replyQueue;
  replyQueueMutations: typeof replyQueueMutations;
  sendEmail: typeof sendEmail;
  socialAccounts: typeof socialAccounts;
  socialAccountsMutations: typeof socialAccountsMutations;
  socialdata: typeof socialdata;
  socialdataMutations: typeof socialdataMutations;
  twitterClient: typeof twitterClient;
  twitterSearch: typeof twitterSearch;
  users: typeof users;
  validators: typeof validators;
  waitlist: typeof waitlist;
  workspaces: typeof workspaces;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
