"use client";

import { useMemo, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { getProspectDisplayData } from "@/features/prospects/lib/getProspectDisplayData";
import { LinkedInProfilePanel } from "@/features/prospects/ui/components/LinkedInProfilePanel";
import { TwitterProfilePanel } from "@/features/profile/ui/components/TwitterProfilePanel";
import {
  TwitterProfileStateProvider,
  type ProfileMode,
  type ProfileUser,
} from "@/features/profile/contexts/TwitterProfileContext";
import { normalizeLinkedInPost } from "@/shared/lib/linkedin/post";
import { summarizeTwitterPost } from "@/shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";
import type { LinkedInProfileData } from "@/shared/lib/linkedin/profile";

/** Real platform panels with fixture data; no social API calls or account mutations. */
export function DemoPlatformProfilePanel({
  prospect,
  onBack,
  onOpenConversation,
}: {
  prospect: Doc<"prospects">;
  onBack: () => void;
  onOpenConversation: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ProfileMode>("posts");
  const [following, setFollowing] = useState(false);
  const identity = getProspectDisplayData(prospect);
  const posts = useMemo(
    () =>
      (prospect.evidencePosts ?? []).flatMap((post) => {
        const summary = summarizeTwitterPost(post);
        return summary ? [toFallbackTweetFromSummary(summary)] : [];
      }),
    [prospect.evidencePosts]
  );
  const linkedInProfile = useMemo<LinkedInProfileData>(
    () => ({
      entityType: "person",
      username: identity.linkedinUsername ?? "demo-profile",
      firstName: identity.displayName.split(" ")[0],
      lastName: identity.displayName.split(" ").slice(1).join(" "),
      displayName: identity.displayName,
      headline: prospect.title ?? "",
      summary: prospect.briefIntro,
      profilePictureUrl: identity.avatarUrl,
      profileUrl: identity.profileUrl,
      location: prospect.location,
      followerCount: 1284,
      connectionCount: 500,
      viewerAccountConnected: true,
      relationshipStatusKnown: true,
      connectionStatus: "not_connected",
      positions: prospect.company
        ? [
            {
              title: prospect.title ?? "",
              companyName: prospect.company,
              isCurrent: true,
            },
          ]
        : [],
      education: [],
      skills: (prospect.matchedKeywords ?? []).map((name) => ({ name })),
      recentPosts: (prospect.evidencePosts ?? []).flatMap((post) => {
        const normalized = normalizeLinkedInPost(post);
        return normalized ? [normalized] : [];
      }),
    }),
    [
      prospect,
      identity.avatarUrl,
      identity.displayName,
      identity.linkedinUsername,
      identity.profileUrl,
    ]
  );
  if (prospect.platform === "linkedin")
    return (
      <LinkedInProfilePanel
        prospectId={prospect._id}
        profile={linkedInProfile}
        localActions={{ onConnect: async () => {} }}
        onBack={onBack}
        onOpenConversation={onOpenConversation}
        disableMobileDrawer
        className="max-w-none"
      />
    );
  const profile: ProfileUser = {
    id: 1,
    id_str: prospect._id,
    name: identity.displayName,
    screen_name: identity.twitterUsername ?? "demo_profile",
    description: prospect.briefIntro,
    location: prospect.location,
    url: prospect.websiteUrl,
    profile_image_url_https: identity.avatarUrl ?? "",
    protected: false,
    verified: identity.verified,
    followers_count: 1284,
    friends_count: 412,
    listed_count: 12,
    favourites_count: 738,
    statuses_count: posts.length,
    created_at: "2020-04-12T00:00:00.000Z",
    can_dm: true,
  };
  return (
    <TwitterProfileStateProvider
      value={{
        isOpen: true,
        profile,
        loadingProfile: false,
        loadingTab: false,
        activeTab,
        timelines: { posts, replies: [], quotes: [] },
        cursors: {},
        relationship: {
          viewerFollowsTarget: following,
          targetFollowsViewer: false,
          resolution: "verified",
          badge: following ? "you_following" : "none",
          primaryAction: following ? "unfollow" : "follow",
          primaryLabel: following ? "Unfollow" : "Follow",
        },
        setTab: async (tab) => setActiveTab(tab),
        openProfile: async () => {},
        closeProfile: () => {},
        loadMore: async () => {},
        retryProfile: async () => {},
        prefetchProfile: async () => {},
        refreshProfileDisplay: async () => {},
      }}
    >
      <TwitterProfilePanel
        prospectId={prospect._id}
        localActions={{
          onFollowAction: async (action) => setFollowing(action === "follow"),
        }}
        onBackAction={onBack}
        onOpenConversationAction={onOpenConversation}
        disableMobileDrawer
        className="max-w-none"
      />
    </TwitterProfileStateProvider>
  );
}
