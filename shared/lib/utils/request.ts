/**
 * Shared request utilities
 * Centralizes request-related functionality used across the application
 */

/**
 * Generates a unique request ID with a given prefix
 * @param prefix - The prefix for the request ID (e.g., 'llm_filter', 'keyword_gen')
 * @returns A unique request ID string
 */
export function generateRequestId(prefix: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${timestamp}_${randomSuffix}`;
}

/**
 * Generates a unique ID without timestamp (for shorter IDs)
 * @param prefix - The prefix for the ID
 * @returns A unique ID string
 */
export function generateUniqueId(prefix: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${randomSuffix}`;
}

/**
 * Common request metadata structure
 */
export interface RequestMetadata {
  requestId: string;
  timestamp: string;
  processingTimeMs?: number;
}

/**
 * Creates initial request metadata
 * @param requestId - The request ID
 * @returns Initial request metadata
 */
export function createRequestMetadata(requestId: string): RequestMetadata {
  return {
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Updates request metadata with processing time
 * @param metadata - The initial metadata
 * @param startTime - The start time in milliseconds
 * @returns Updated metadata with processing time
 */
export function finalizeRequestMetadata(
  metadata: RequestMetadata,
  startTime: number
): RequestMetadata {
  return {
    ...metadata,
    processingTimeMs: Date.now() - startTime,
  };
}
