/**
 * Shared Search Types
 * Extracted types for search functionality across the application.
 */

import type { ThreadData } from "@/features/agent/ui/components/ThreadCard";

/**
 * Result from vector search in thread messages.
 * Returned by searchProspectMessages action.
 */
export interface ThreadSearchResult {
  /** The thread ID */
  threadId: string;
  /** Thread data for display */
  thread: ThreadData;
  /** Preview text from the matched message */
  matchPreview: string;
  /** Number of messages matching the query */
  matchCount: number;
}
