/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as cryptoActions from "../cryptoActions.js";
import type * as http from "../http.js";
import type * as lib_notificationHelpers from "../lib/notificationHelpers.js";
import type * as lib_userUtils from "../lib/userUtils.js";
import type * as mediaUpload from "../mediaUpload.js";
import type * as mediaUploadMutations from "../mediaUploadMutations.js";
import type * as notifications from "../notifications.js";
import type * as promo from "../promo.js";
import type * as replyQueue from "../replyQueue.js";
import type * as replyQueueMutations from "../replyQueueMutations.js";
import type * as sendEmail from "../sendEmail.js";
import type * as socialAccounts from "../socialAccounts.js";
import type * as socialAccountsMutations from "../socialAccountsMutations.js";
import type * as socialapi from "../socialapi.js";
import type * as socialapiMutations from "../socialapiMutations.js";
import type * as twitterClient from "../twitterClient.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as waitlist from "../waitlist.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  cryptoActions: typeof cryptoActions;
  http: typeof http;
  "lib/notificationHelpers": typeof lib_notificationHelpers;
  "lib/userUtils": typeof lib_userUtils;
  mediaUpload: typeof mediaUpload;
  mediaUploadMutations: typeof mediaUploadMutations;
  notifications: typeof notifications;
  promo: typeof promo;
  replyQueue: typeof replyQueue;
  replyQueueMutations: typeof replyQueueMutations;
  sendEmail: typeof sendEmail;
  socialAccounts: typeof socialAccounts;
  socialAccountsMutations: typeof socialAccountsMutations;
  socialapi: typeof socialapi;
  socialapiMutations: typeof socialapiMutations;
  twitterClient: typeof twitterClient;
  users: typeof users;
  validators: typeof validators;
  waitlist: typeof waitlist;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
