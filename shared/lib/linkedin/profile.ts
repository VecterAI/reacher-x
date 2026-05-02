import type { UnifiedPost } from "../platforms/types";

export interface LinkedInProfileData {
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  headline: string;
  summary?: string;
  profilePictureUrl?: string;
  backgroundImageUrl?: string;
  profileUrl?: string;
  urn?: string;
  isCreator?: boolean;
  isPremium?: boolean;
  location?: string;
  followerCount?: number;
  connectionCount?: number;
  connectionStatus?: "connected" | "pending" | "not_connected";
  relationshipStatusKnown?: boolean;
  viewerAccountConnected?: boolean;
  viewerAccountStatus?:
    | "connected"
    | "connecting"
    | "reconnect_required"
    | "action_required"
    | "restricted"
    | "disconnected";
  contact?: {
    emailAddress?: string | null;
    websites?: Array<{ url: string; category: string }>;
  };
  positions: Array<{
    title: string;
    companyName: string;
    companyId?: string;
    companyLogo?: string;
    companyUrl?: string;
    location?: string;
    description?: string;
    employmentType?: string;
    start?: { year: number; month?: number };
    end?: { year: number; month?: number };
    isCurrent: boolean;
  }>;
  education: Array<{
    school: string;
    schoolLogo?: string;
    degree?: string;
    fieldOfStudy?: string;
    start?: { year: number };
    end?: { year: number };
  }>;
  skills: Array<{
    name: string;
    passedAssessment?: boolean;
  }>;
  languages?: Array<{
    name: string;
    proficiency?: string;
  }>;
  featuredPosts?: Array<{
    url: string;
    text?: string;
    title?: string;
    imageUrl?: string;
    type?: string;
  }>;
  currentCompany?: {
    name: string;
    description?: string;
    website?: string;
    logoUrl?: string;
    staffCount?: number;
    industry?: string;
    headquarter?: string;
    specialities?: string[];
    founded?: number;
  };
  recentPosts: UnifiedPost[];
  recentPostsCursor?: string | null;
}
