// convex/lib/types.ts
import { Id } from "../_generated/dataModel";

// WorkOS Event Data Types based on official documentation
export interface WorkOSEvent {
  object: "event";
  id: string;
  event: string;
  data: WorkOSUserData | WorkOSGroupData | WorkOSOrganizationData;
  created_at: string;
}

// Generic WorkOS Event type that matches the SDK
export type WorkOSGenericEvent = {
  id: string;
  event: string;
  data: unknown;
  created_at?: string;
};

export interface WorkOSUserData {
  id: string;
  directory_id: string;
  organization_id: string;
  idp_id: string;
  first_name: string;
  last_name: string;
  email: string;
  state: "active" | "inactive" | "suspended";
  created_at: string;
  updated_at: string;
  custom_attributes?: Record<string, unknown>;
  role?: {
    slug: string;
  };
  raw_attributes?: Record<string, unknown>;
}

export interface WorkOSGroupData {
  id: string;
  directory_id: string;
  organization_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  raw_attributes?: Record<string, unknown>;
}

export interface WorkOSOrganizationData {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  domains?: string[];
  raw_attributes?: Record<string, unknown>;
}

// Convex Database Types
export interface EventCursor {
  _id: Id<"eventCursors">;
  type: string;
  cursor: string;
  updatedAt: number;
}

export interface User {
  _id: Id<"users">;
  workosUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  createdAt: number;
  deletedAt?: number;
  isDeleted?: boolean;
  lastSyncedAt?: number;
}

export interface SocialAccount {
  _id: Id<"socialAccounts">;
  userId: Id<"users">;
  provider: string;
  providerAccountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

// Event Processing Context Type - using generic Convex context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventProcessingContext = any; // Will be properly typed by Convex

// Event Processing Result
export interface EventProcessingResult {
  processed: number;
  latestCursor: string | undefined;
  hasMore: boolean;
}
