import type { Tweet, User } from "@/features/threads/types";

function mockUser(
  overrides: Partial<User> & Pick<User, "name" | "screen_name">
): User {
  return {
    id: Number(overrides.id_str ?? "1"),
    id_str: overrides.id_str ?? "1",
    protected: false,
    verified: overrides.verified ?? false,
    followers_count: overrides.followers_count ?? 4200,
    friends_count: overrides.friends_count ?? 380,
    listed_count: overrides.listed_count ?? 40,
    favourites_count: overrides.favourites_count ?? 1200,
    statuses_count: overrides.statuses_count ?? 2100,
    created_at: overrides.created_at ?? "Mon Jan 01 12:00:00 +0000 2024",
    profile_image_url_https:
      overrides.profile_image_url_https ??
      "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png",
    can_dm: true,
    ...overrides,
  };
}

/** Deterministic Unsplash portraits so dev previews show realistic avatars. */
const MOCK_AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=128&h=128&q=80&crop=faces",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=128&h=128&q=80&crop=faces",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=128&h=128&q=80&crop=faces",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=128&h=128&q=80&crop=faces",
];

/**
 * Local visualization fixtures shown in development so the section is
 * previewable without provider calls. Never shown in production unless
 * LANDING_USE_MOCK_TESTIMONIALS=1. Numeric ids keep them indistinguishable
 * from real feed entries so they flow through the same render path.
 */
export const MOCK_PUBLIC_TESTIMONIALS: Tweet[] = [
  {
    id_str: "1933456789000001",
    tweet_created_at: "2026-06-12T14:22:00.000Z",
    full_text:
      "ReacherX found people I would have never searched for manually. The context on each match is actually useful, and approving every message keeps it human.",
    favorite_count: 48,
    reply_count: 6,
    retweet_count: 9,
    quote_count: 2,
    user: mockUser({
      id_str: "101",
      name: "Maya Chen",
      screen_name: "mayachen",
      verified: true,
      followers_count: 18200,
      profile_image_url_https: MOCK_AVATARS[0],
    }),
  },
  {
    id_str: "1933456789000002",
    tweet_created_at: "2026-06-18T09:05:00.000Z",
    full_text:
      "I told △ Agent who I needed in plain English and it kept surfacing new matches every day. Feels like a researcher that never sleeps, with me still in control.",
    favorite_count: 31,
    reply_count: 4,
    retweet_count: 5,
    quote_count: 1,
    user: mockUser({
      id_str: "102",
      name: "Jordan Blake",
      screen_name: "jordanblake",
      followers_count: 6400,
      profile_image_url_https: MOCK_AVATARS[1],
    }),
  },
  {
    id_str: "1933456789000003",
    tweet_created_at: "2026-07-02T16:40:00.000Z",
    full_text:
      "Open source + approval before every send is exactly what I wanted. No black box sequences, no spammy automation. Just live context and drafts I can trust.",
    favorite_count: 67,
    reply_count: 11,
    retweet_count: 14,
    quote_count: 3,
    user: mockUser({
      id_str: "103",
      name: "Priya Nair",
      screen_name: "priyanair",
      verified: true,
      followers_count: 22100,
      profile_image_url_https: MOCK_AVATARS[2],
    }),
  },
  {
    id_str: "1933456789000004",
    tweet_created_at: "2026-07-09T11:18:00.000Z",
    full_text:
      "We use one workspace for customers and another for candidates. △ Agent adapts fast, and the outreach drafts actually sound like us after a few edits.",
    favorite_count: 22,
    reply_count: 3,
    retweet_count: 4,
    quote_count: 0,
    user: mockUser({
      id_str: "104",
      name: "Alex Rivera",
      screen_name: "arivera",
      followers_count: 3900,
      profile_image_url_https: MOCK_AVATARS[3],
    }),
  },
];
