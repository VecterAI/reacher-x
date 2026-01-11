"use node";

import {
  TwitterApi,
  ApiResponseError,
  ApiRequestError,
  ApiPartialResponseError,
  EUploadMimeType,
} from "twitter-api-v2";
import { TwitterApiRateLimitPlugin } from "@twitter-api-v2/plugin-rate-limit";
import { TwitterApiAutoTokenRefresher } from "@twitter-api-v2/plugin-token-refresher";
import { logger } from "../shared/lib/logger";

// Global rate limit plugin instance
const rateLimitPlugin = new TwitterApiRateLimitPlugin();

/**
 * Maps content-type string to EUploadMimeType enum
 */
function getMediaType(contentType: string): EUploadMimeType {
  switch (contentType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return EUploadMimeType.Jpeg;
    case "image/png":
      return EUploadMimeType.Png;
    case "image/gif":
      return EUploadMimeType.Gif;
    case "image/webp":
      return EUploadMimeType.Webp;
    case "video/mp4":
    case "video/quicktime":
      // X API accepts H.264 videos in both MP4 and MOV containers
      return EUploadMimeType.Mp4;
    default:
      // Reject unsupported types to fail fast & clearly
      throw new Error(
        `Unsupported media type: ${contentType}. Allowed: image/jpeg, image/png, image/webp, image/gif, video/mp4, video/quicktime.`
      );
  }
}

/**
 * Gets the appropriate media category based on content type
 */
function getMediaCategory(
  contentType: string
): "tweet_image" | "tweet_video" | "tweet_gif" {
  if (contentType.toLowerCase().startsWith("video/")) {
    return "tweet_video";
  } else if (contentType.toLowerCase().includes("gif")) {
    return "tweet_gif";
  } else if (contentType.toLowerCase().startsWith("image/")) {
    return "tweet_image";
  } else {
    return "tweet_image"; // Default to image category
  }
}

/**
 * Creates a Twitter API client for robust posting with enhanced error handling and rate limiting
 */
export function createTwitterClient(
  accessToken: string,
  options?: {
    refreshToken?: string;
    // Persist refreshed tokens (called by plugin token refresher)
    onTokenUpdate?: (args: {
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
    }) => Promise<void> | void;
  }
) {
  const plugins: unknown[] = [rateLimitPlugin];

  // Add token refresher plugin if refresh token is available
  if (options?.refreshToken) {
    const tokenRefresherPlugin = new TwitterApiAutoTokenRefresher({
      refreshToken: options.refreshToken,
      refreshCredentials: {
        clientId: process.env.X_CLIENT_ID!,
        clientSecret: process.env.X_CLIENT_SECRET!,
      },
      onTokenUpdate: (newTokens: {
        accessToken: string;
        refreshToken?: string;
        expiresIn?: number;
      }) => {
        // Persist refreshed tokens if handler provided
        if (options?.onTokenUpdate) {
          try {
            void options.onTokenUpdate(newTokens);
          } catch (e) {
            logger.warn("onTokenUpdate handler failed:", e);
          }
        } else {
          logger.info("Tokens refreshed:", newTokens);
        }
      },
    });
    plugins.push(tokenRefresherPlugin);
  }

  // For OAuth 2.0 user context, create client with access token as Bearer token

  const client = new TwitterApi(accessToken, { plugins: plugins as any });

  logger.info(`Created Twitter client with OAuth 2.0 user context`);
  logger.info(`Client plugins:`, plugins.length);

  // Return the read-write client for posting
  return client.readWrite;
}

/**
 * Creates a Twitter API client for OAuth operations
 */
export function createOAuthClient() {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("X_CLIENT_ID and X_CLIENT_SECRET must be set");
  }

  return new TwitterApi({ clientId, clientSecret });
}

/**
 * Enhanced error handler for Twitter API operations
 */
export function handleTwitterError(error: unknown): never {
  if (error instanceof ApiResponseError) {
    if (error.rateLimitError) {
      const resetTime = error.rateLimit?.reset
        ? new Date(error.rateLimit.reset * 1000)
        : new Date();
      throw new Error(
        `Rate limit exceeded. Reset at: ${resetTime.toISOString()}`
      );
    }

    if (error.isAuthError) {
      throw new Error(
        "Authentication failed. Please reconnect your Twitter account."
      );
    }

    // Extract specific error messages from Twitter API
    const errorMessages =
      error.errors
        ?.map((e) => {
          if ("detail" in e) return e.detail;
          if ("message" in e) return e.message;
          return "Unknown error";
        })
        .join(", ") || error.message;
    throw new Error(`Twitter API error: ${errorMessages}`);
  }

  if (error instanceof ApiRequestError) {
    throw new Error(
      `Network error: ${error.requestError?.message || error.message}`
    );
  }

  if (error instanceof ApiPartialResponseError) {
    throw new Error(
      `Partial response error: ${error.responseError?.message || error.message}`
    );
  }

  // Handle generic errors
  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Unknown error occurred");
}

/**
 * Get current rate limit status for a specific endpoint
 */
export async function getRateLimitStatus(endpoint: string) {
  return await rateLimitPlugin.v2.getRateLimit(endpoint);
}

/**
 * Resolve Content-Type headers for a list of media URLs using HEAD requests.
 * Falls back to 'application/octet-stream' on failure.
 */
export async function getMediaTypesFromUrls(urls: string[]): Promise<string[]> {
  const types: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      const ct = res.headers.get("content-type") || "application/octet-stream";
      types.push(ct);
    } catch (e) {
      logger.warn(`Could not determine content-type for ${url}:`, e);
      types.push("application/octet-stream");
    }
  }
  return types;
}

/**
 * Uploads media files to Twitter using the robust twitter-api-v2 media upload
 */
export async function uploadMediaFiles(
  client: ReturnType<typeof createTwitterClient>,
  mediaUrls: string[]
): Promise<string[]> {
  const mediaIds: string[] = [];

  for (const url of mediaUrls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch media: ${url} - ${response.status} ${response.statusText}`
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const mediaType =
        response.headers.get("content-type") || "application/octet-stream";

      // Check media size limits (Twitter API v2 limits)
      const maxImageSize = 5 * 1024 * 1024; // 5MB for images (non-GIF)
      const maxGifSize = 15 * 1024 * 1024; // 15MB for GIF
      const maxVideoSize = 512 * 1024 * 1024; // 512MB for videos

      if (mediaType.startsWith("image/")) {
        if (mediaType === "image/gif" && buffer.length > maxGifSize) {
          throw new Error(
            `GIF too large: ${buffer.length} bytes (max: ${maxGifSize} bytes)`
          );
        }
        if (mediaType !== "image/gif" && buffer.length > maxImageSize) {
          throw new Error(
            `Image too large: ${buffer.length} bytes (max: ${maxImageSize} bytes)`
          );
        }
      }

      if (mediaType.startsWith("video/") && buffer.length > maxVideoSize) {
        throw new Error(
          `Video too large: ${buffer.length} bytes (max: ${maxVideoSize} bytes)`
        );
      }

      logger.info(`Media size: ${buffer.length} bytes, type: ${mediaType}`);

      // Use twitter-api-v2's v2 media upload (v1.1 endpoints deprecated June 2025)
      const uploadOptions = {
        media_type: getMediaType(mediaType),
        media_category: getMediaCategory(mediaType), // Dynamic media category based on content type
      };

      logger.info(`Uploading media with options:`, uploadOptions);
      const mediaId = await client.v2.uploadMedia(buffer, uploadOptions);

      mediaIds.push(mediaId);
      logger.info(`Successfully uploaded media ${url} with ID: ${mediaId}`);
    } catch (error) {
      logger.error(`Failed to upload media ${url}:`, error);

      // Log additional details for debugging
      if (error instanceof ApiResponseError) {
        logger.error(
          `API Response Error - Code: ${error.code}, Headers:`,
          error.headers
        );
        logger.error(`Rate Limit Info:`, error.rateLimit);
        logger.error(`Is Auth Error:`, error.isAuthError);
        logger.error(`Is Rate Limit Error:`, error.rateLimitError);
      }

      // Use enhanced error handling for Twitter API errors
      if (
        error instanceof ApiResponseError ||
        error instanceof ApiRequestError ||
        error instanceof ApiPartialResponseError
      ) {
        handleTwitterError(error);
      }

      throw new Error(
        `Media upload failed for ${url}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  return mediaIds;
}

/**
 * Attaches media descriptions (alt text) to uploaded media using Twitter API v2
 */
export async function attachMediaDescriptions(
  client: ReturnType<typeof createTwitterClient>,
  mediaIds: string[],
  descriptions: string[]
): Promise<void> {
  // Ensure we have matching arrays
  if (mediaIds.length !== descriptions.length) {
    throw new Error(
      `Media IDs count (${mediaIds.length}) doesn't match descriptions count (${descriptions.length})`
    );
  }

  for (let i = 0; i < mediaIds.length; i++) {
    const mediaId = mediaIds[i];
    const description = descriptions[i];

    // Skip if description is empty or just whitespace
    if (!description || description.trim().length === 0) {
      logger.info(`Skipping empty description for media ${mediaId}`);
      continue;
    }

    try {
      // Use Twitter API v2 to create media metadata with alt text
      await client.v2.createMediaMetadata(mediaId, {
        alt_text: { text: description.trim() },
      });

      logger.info(
        `Successfully attached description to media ${mediaId}: "${description}"`
      );
    } catch (error) {
      // Improve diagnostics without stopping overall flow
      if (error instanceof ApiResponseError) {
        const msg =
          error.errors
            ?.map((e) => {
              if ("detail" in e) return e.detail;
              if ("message" in e) return e.message;
              return "Unknown error";
            })
            .join(", ") || error.message;
        logger.warn(
          `Alt text attachment failed for media ${mediaId} (HTTP ${error.code}). Message: ${msg}`
        );
      } else {
        logger.error(
          `Failed to attach description to media ${mediaId}:`,
          error
        );
      }
      // Don't throw here - continue with other media items
      // The tweet will still be posted, just without this description
    }
  }
}
