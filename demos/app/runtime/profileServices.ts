import { api } from "@/convex/_generated/api";
import type { LinkedInProfileData } from "@/shared/lib/linkedin/profile";
import { normalizeLinkedInPost } from "@/shared/lib/linkedin/post";
import { normalizeProspectProfileData } from "@/features/prospects/lib/normalizeProspectProfileData";
import type { HydratedTwitterProfile } from "@/shared/lib/twitter/hydration";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { getStringProperty } from "@/convex/lib/typeGuards";
import type { createAppFixtures } from "./appFixtures";
import type { registerAccountServices } from "./accountServices";
import type { LocalClient } from "./LocalClient";

/** Populate the production profile panels from the same fictional research records. */
export function registerProfileServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>,
  accounts: ReturnType<typeof registerAccountServices>
) {
  const personFor = (id: string) => {
    const person = state.prospects.find(
      (person) =>
        person._id === id ||
        person.socialProfiles?.twitter?.username === id ||
        person.socialProfiles?.linkedin?.username === id
    );
    if (!person) throw new Error("Profile not found");
    return person;
  };
  const linkedin = (id: string): LinkedInProfileData => {
    const person = personFor(id);
    const profile = normalizeProspectProfileData(person)!;
    const names = (person.displayName ?? "").split(" ");
    return {
      username: person.socialProfiles?.linkedin?.username ?? id,
      firstName: names[0],
      lastName: names.slice(1).join(" "),
      displayName: person.displayName ?? "",
      headline: person.title ?? "",
      summary: person.briefIntro,
      profilePictureUrl: profile.avatarUrl,
      profileUrl: person.socialProfiles?.linkedin?.url,
      urn: `urn:li:person:${person._id}`,
      location: person.location,
      followerCount: 740 + state.prospects.indexOf(person) * 139,
      connectionCount: 500,
      connectionStatus: "not_connected",
      relationshipStatusKnown: true,
      viewerAccountConnected: accounts.snapshot("linkedin").isConnected,
      viewerAccountStatus: "connected",
      positions: [
        {
          title: person.title ?? "",
          companyName: person.company ?? "Independent practice",
          description: person.briefIntro,
          isCurrent: true,
          start: { year: 2022, month: 3 },
        },
      ],
      education: [],
      skills: (person.matchedKeywords ?? []).map((name) => ({ name })),
      ...(person.company
        ? {
            currentCompany: {
              name: person.company,
              description: person.briefIntro,
              website: person.websiteUrl,
            },
          }
        : {}),
      recentPosts: (person.evidencePosts ?? [])
        .map((post) => normalizeLinkedInPost(post))
        .filter((post) => post !== null),
      recentPostsCursor: null,
    };
  };
  client.register(api.linkedin.getLinkedInProfile, ({ prospectId }) =>
    linkedin(prospectId)
  );
  client.register(api.linkedin.getLinkedInIdentityProfile, ({ identity }) =>
    linkedin(identity.username ?? identity.providerId ?? "")
  );
  client.register(
    api.linkedin.getLinkedInProfilePostsPage,
    ({ prospectId, cursor }) => ({
      posts: cursor ? [] : linkedin(prospectId).recentPosts,
      nextCursor: null,
    })
  );
  client.register(
    api.linkedin.getLinkedInIdentityProfilePostsPage,
    ({ identity, cursor }) => ({
      posts: cursor
        ? []
        : linkedin(identity.username ?? identity.providerId ?? "").recentPosts,
      nextCursor: null,
    })
  );
  const following = new Set<string>();
  client.register(
    api.twitterEngagement.getFollowingsForTargets,
    ({ targetUserIds }) =>
      Object.fromEntries(
        targetUserIds.map((id) => [
          id,
          { following: following.has(id), updatedAt: state.startedAt },
        ])
      )
  );
  client.register(api.twitterEngagement.getEngagementsForPosts, () => ({}));
  const twitter = (username: string): HydratedTwitterProfile => {
    const person = personFor(username);
    return {
      id: state.prospects.indexOf(person) + 1000,
      id_str: `demo_x_${person._id}`,
      name: person.displayName ?? "",
      screen_name: username,
      username,
      description: person.briefIntro,
      location: person.location,
      protected: false,
      verified: false,
      followers_count: 820 + state.prospects.indexOf(person) * 117,
      friends_count: 320,
      listed_count: 8,
      favourites_count: 140,
      statuses_count: 240,
      created_at: "2021-03-01T10:00:00.000Z",
      profile_image_url_https:
        normalizeProspectProfileData(person)?.avatarUrl ?? "",
      can_dm: true,
      can_dm_known: true,
    };
  };
  client.register(api.socialapi.getTwitterProfileDisplay, ({ username }) => ({
    username,
    profileUserId: twitter(username).id_str,
    profile: twitter(username),
    fetchedAt: getCurrentUTCTimestamp(),
    relationship: {
      resolution: "verified",
      viewerFollowsTarget: following.has(twitter(username).id_str),
      targetFollowsViewer: false,
      badge: "none",
      primaryAction: following.has(twitter(username).id_str)
        ? "unfollow"
        : "follow",
      primaryLabel: following.has(twitter(username).id_str)
        ? "Unfollow"
        : "Follow",
    } as const,
  }));
  const setFollowing = async (targetUserId: string, value: boolean) => {
    const account = await client.query(
      api.connectedAccounts.getConnectionSnapshot,
      { platform: "twitter" }
    );
    if (!account.isConnected)
      throw new Error("Connect X/Twitter before following a profile");
    if (
      !state.prospects.some((person) => `demo_x_${person._id}` === targetUserId)
    )
      throw new Error("Profile not found");
    if (value) following.add(targetUserId);
    else following.delete(targetUserId);
    return { success: true as const };
  };
  client.register(api.x.followUser, ({ targetUserId }) =>
    setFollowing(targetUserId, true)
  );
  client.register(api.x.unfollowUser, ({ targetUserId }) =>
    setFollowing(targetUserId, false)
  );
  client.register(
    api.socialapi.getHydratedTwitterTimelineFromSocialApi,
    ({ username, mode, cursor }) => ({
      mode,
      fetchedAt: getCurrentUTCTimestamp(),
      nextCursor: undefined,
      tweets:
        cursor || mode !== "posts"
          ? []
          : (personFor(username).evidencePosts ?? []).map((post, index) => ({
              id_str:
                getStringProperty(post, "id_str") ??
                `${BigInt("1900000000000000000") + BigInt(state.prospects.indexOf(personFor(username)) * 100 + index)}`,
              full_text:
                getStringProperty(post, "full_text") ??
                getStringProperty(post, "text") ??
                "",
              tweet_created_at: new Date(
                personFor(username)._creationTime - (index + 1) * 86400000
              ).toISOString(),
              user: twitter(username),
              favorite_count: 24 + index * 13,
              retweet_count: 3 + index,
              reply_count: 4 + index,
            })),
    })
  );
}
