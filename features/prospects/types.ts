/**
 * Type definitions for Prospects feature
 * Single source of truth for prospect-related types
 */
import type { Tweet } from "@/features/threads/types";
import type {
  TwitterInteractionDiscoverySource,
  TwitterInteractionOrigin,
  TwitterPostRef,
  TwitterPostSummary,
} from "@/shared/lib/twitter/contracts";

/**
 * A participant in a prospect interaction/conversation
 */
export interface ProspectInteractionParticipant {
  name: string;
  username: string;
  avatarUrl?: string;
}

/**
 * An interaction between the user/agent and a prospect
 * Represents a thread where the user has replied to the prospect
 */
export interface ProspectInteraction {
  /** Unique identifier for this interaction */
  id: string;
  /** The original post the conversation started from */
  originalPost: Tweet;
  /** All participants in the conversation (including prospect and user) */
  participants: ProspectInteractionParticipant[];
  /** Thread ID for fetching full conversation */
  threadId: string;
  /** When the user's reply was posted */
  repliedAt: number;
  /** Provenance when ReacherX can determine it */
  origin: TwitterInteractionOrigin;
  discoveredVia: TwitterInteractionDiscoverySource;
  sourcePostRef?: TwitterPostRef | null;
  sourcePostSummary?: TwitterPostSummary | null;
  replyPostRef?: TwitterPostRef | null;
  replyPostSummary?: TwitterPostSummary | null;
  /** Preview of the last reply in the thread */
  lastReplyPreview?: string;
}
