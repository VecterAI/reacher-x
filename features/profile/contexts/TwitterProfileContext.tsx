"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Tweet } from "@/features/threads/types";
import type {
  HydratedTwitterProfile,
  HydratedTwitterProfileDisplayPayload,
  HydratedTwitterRelationshipDisplay,
  HydratedTwitterTimelinePage,
  TwitterTimelineMode,
} from "@/shared/lib/twitter/hydration";

export type ProfileMode = TwitterTimelineMode;
export type ProfileUser = HydratedTwitterProfile;
export type ProfileRelationship = HydratedTwitterRelationshipDisplay;

type CachedTimelinePage = {
  tweets: Tweet[];
  nextCursor?: string;
  fetchedAt: number;
};

type ProfileCacheEntry = {
  profileUserId: string;
  profile: ProfileUser;
  relationship: ProfileRelationship;
  profileFetchedAt: number;
  timelines: Partial<Record<ProfileMode, CachedTimelinePage>>;
};

interface ProfileState {
  isOpen: boolean;
  username?: string;
  userId?: string;
  profile?: ProfileUser;
  relationship?: ProfileRelationship;
  loadingProfile: boolean;
  activeTab: ProfileMode;
  loadingTab: boolean;
  cursors: Partial<Record<ProfileMode, string | undefined>>;
  timelines: Partial<Record<ProfileMode, Tweet[]>>;
  error?: string;
}

interface TwitterProfileContextValue extends ProfileState {
  openProfile: (params: {
    username: string;
    initialTab?: ProfileMode;
    seedProfile?: ProfileUser;
  }) => Promise<void>;
  closeProfile: () => void;
  loadMore: (mode?: ProfileMode) => Promise<void>;
  retryProfile: () => Promise<void>;
  setTab: (mode: ProfileMode) => Promise<void>;
  prefetchProfile: (username: string) => Promise<void>;
  refreshProfileDisplay: () => Promise<void>;
}

const TwitterProfileContext = createContext<
  TwitterProfileContextValue | undefined
>(undefined);

const PROFILE_CACHE_TTL_MS = 30_000;

function isFresh(fetchedAt: number | undefined) {
  return (
    typeof fetchedAt === "number" &&
    Date.now() - fetchedAt < PROFILE_CACHE_TTL_MS
  );
}

function getFreshCachedPage(
  entry: ProfileCacheEntry | undefined,
  mode: ProfileMode
): CachedTimelinePage | undefined {
  const page = entry?.timelines[mode];
  return page && isFresh(page.fetchedAt) ? page : undefined;
}

function toCacheEntry(
  display: HydratedTwitterProfileDisplayPayload,
  timeline: HydratedTwitterTimelinePage
): ProfileCacheEntry {
  return {
    profileUserId: display.profileUserId,
    profile: display.profile,
    relationship: display.relationship,
    profileFetchedAt: display.fetchedAt,
    timelines: {
      [timeline.mode]: {
        tweets: timeline.tweets,
        nextCursor: timeline.nextCursor,
        fetchedAt: timeline.fetchedAt,
      },
    },
  };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProfileState>({
    isOpen: false,
    loadingProfile: false,
    activeTab: "posts",
    loadingTab: false,
    cursors: {},
    timelines: {},
  });
  const requestRef = useRef(0);
  const cacheRef = useRef<Map<string, ProfileCacheEntry>>(new Map());

  const getProfileDisplay = useAction(api.socialapi.getTwitterProfileDisplay);
  const getTimeline = useAction(api.socialapi.getHydratedTwitterTimelineFromSocialApi);

  const writeCache = useCallback(
    (
      username: string,
      updater: (current?: ProfileCacheEntry) => ProfileCacheEntry
    ) => {
      const next = updater(cacheRef.current.get(username));
      cacheRef.current.set(username, next);
    },
    []
  );

  const prefetchProfile = useCallback(
    async (username: string) => {
      const cached = cacheRef.current.get(username);
      if (
        cached &&
        isFresh(cached.profileFetchedAt) &&
        getFreshCachedPage(cached, "posts")
      ) {
        return;
      }

      try {
        const [display, timeline] = await Promise.all([
          getProfileDisplay({ username }),
          getTimeline({
            username,
            mode: "posts",
          }),
        ]);
        cacheRef.current.set(username, toCacheEntry(display, timeline));
      } catch {
        // Prefetch is opportunistic; ignore failures.
      }
    },
    [getProfileDisplay, getTimeline]
  );

  const refreshProfileDisplay = useCallback(async () => {
    if (!state.username) {
      return;
    }

    const localUsername = state.username;
    const reqId = ++requestRef.current;
    try {
      const display = await getProfileDisplay({ username: localUsername });
      writeCache(localUsername, (existing) => ({
        profileUserId: display.profileUserId,
        profile: display.profile,
        relationship: display.relationship,
        profileFetchedAt: display.fetchedAt,
        timelines: existing?.timelines ?? {},
      }));

      setState((current) => {
        if (
          reqId !== requestRef.current ||
          current.username !== localUsername
        ) {
          return current;
        }

        return {
          ...current,
          userId: display.profileUserId,
          profile: display.profile,
          relationship: display.relationship,
          error: undefined,
        };
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to refresh profile.";
      setState((current) => {
        if (
          reqId !== requestRef.current ||
          current.username !== localUsername
        ) {
          return current;
        }
        return {
          ...current,
          error: message,
        };
      });
    }
  }, [getProfileDisplay, state.username, writeCache]);

  const openProfile = useCallback(
    async ({
      username,
      initialTab,
    }: {
      username: string;
      initialTab?: ProfileMode;
      seedProfile?: ProfileUser;
    }) => {
      const tab = initialTab ?? "posts";
      const reqId = ++requestRef.current;

      setState({
        isOpen: true,
        username,
        userId: undefined,
        profile: undefined,
        relationship: undefined,
        loadingProfile: true,
        activeTab: tab,
        loadingTab: true,
        timelines: {},
        cursors: {},
        error: undefined,
      });

      try {
        const [display, timeline] = await Promise.all([
          getProfileDisplay({ username }),
          getTimeline({
            username,
            mode: tab,
          }),
        ]);
        cacheRef.current.set(username, toCacheEntry(display, timeline));

        setState((current) => {
          if (reqId !== requestRef.current || current.username !== username) {
            return current;
          }

          return {
            ...current,
            userId: display.profileUserId,
            profile: display.profile,
            relationship: display.relationship,
            loadingProfile: false,
            loadingTab: false,
            timelines: { [tab]: timeline.tweets },
            cursors: { [tab]: timeline.nextCursor },
            error: undefined,
          };
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load profile.";
        setState((current) => {
          if (reqId !== requestRef.current || current.username !== username) {
            return current;
          }

          return {
            ...current,
            userId: undefined,
            profile: undefined,
            relationship: undefined,
            loadingProfile: false,
            loadingTab: false,
            timelines: {},
            cursors: {},
            error: message,
          };
        });
      }
    },
    [getProfileDisplay, getTimeline]
  );

  const closeProfile = useCallback(() => {
    requestRef.current += 1;
    setState((current) => ({ ...current, isOpen: false }));
  }, []);

  const retryProfile = useCallback(async () => {
    if (!state.username) {
      return;
    }

    cacheRef.current.delete(state.username);
    await openProfile({
      username: state.username,
      initialTab: state.activeTab,
    });
  }, [openProfile, state.activeTab, state.username]);

  const setTab = useCallback(
    async (mode: ProfileMode) => {
      if (!state.username) {
        return;
      }

      const localUsername = state.username;
      const reqId = ++requestRef.current;
      const cached = getFreshCachedPage(
        cacheRef.current.get(localUsername),
        mode
      );

      if (cached) {
        setState((current) => ({
          ...current,
          activeTab: mode,
          loadingTab: false,
          timelines: { ...current.timelines, [mode]: cached.tweets },
          cursors: { ...current.cursors, [mode]: cached.nextCursor },
          error: undefined,
        }));
        return;
      }

      setState((current) => ({
        ...current,
        activeTab: mode,
        loadingTab: true,
        error: undefined,
      }));

      try {
        const timeline = await getTimeline({
          username: localUsername,
          mode,
        });

        const cachedEntry = cacheRef.current.get(localUsername);
        const cachedProfile = cachedEntry?.profile ?? state.profile;
        const cachedRelationship = cachedEntry?.relationship ?? state.relationship;
        const cachedUserId = cachedEntry?.profileUserId ?? state.userId;
        if (cachedProfile && cachedRelationship && cachedUserId) {
          writeCache(localUsername, (existing) => ({
            profileUserId: existing?.profileUserId ?? cachedUserId,
            profile: existing?.profile ?? cachedProfile,
            relationship: existing?.relationship ?? cachedRelationship,
            profileFetchedAt: existing?.profileFetchedAt ?? Date.now(),
            timelines: {
              ...existing?.timelines,
              [mode]: {
                tweets: timeline.tweets,
                nextCursor: timeline.nextCursor,
                fetchedAt: timeline.fetchedAt,
              },
            },
          }));
        }

        setState((current) => {
          if (
            reqId !== requestRef.current ||
            current.username !== localUsername
          ) {
            return current;
          }

          return {
            ...current,
            activeTab: mode,
            loadingTab: false,
            timelines: { ...current.timelines, [mode]: timeline.tweets },
            cursors: { ...current.cursors, [mode]: timeline.nextCursor },
            error: undefined,
          };
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load timeline.";
        setState((current) => {
          if (
            reqId !== requestRef.current ||
            current.username !== localUsername
          ) {
            return current;
          }

          return {
            ...current,
            loadingTab: false,
            error: message,
          };
        });
      }
    },
    [
      getTimeline,
      state.profile,
      state.relationship,
      state.userId,
      state.username,
      writeCache,
    ]
  );

  const loadMore = useCallback(
    async (mode?: ProfileMode) => {
      const targetMode = mode ?? state.activeTab;
      const cursor = state.cursors[targetMode];
      if (!cursor || !state.username) {
        return;
      }

      const localUsername = state.username;
      const reqId = ++requestRef.current;
      setState((current) => ({
        ...current,
        loadingTab: true,
        error: undefined,
      }));

      try {
        const timeline = await getTimeline({
          username: localUsername,
          mode: targetMode,
          cursor,
        });

        setState((current) => {
          if (
            reqId !== requestRef.current ||
            current.username !== localUsername
          ) {
            return current;
          }

          const nextTweets = [
            ...(current.timelines[targetMode] ?? []),
            ...timeline.tweets,
          ];

          const cachedEntry = cacheRef.current.get(localUsername);
          const cachedProfile = cachedEntry?.profile ?? state.profile;
          const cachedRelationship = cachedEntry?.relationship ?? state.relationship;
          const cachedUserId = cachedEntry?.profileUserId ?? state.userId;
          if (cachedProfile && cachedRelationship && cachedUserId) {
            writeCache(localUsername, (existing) => ({
              profileUserId: existing?.profileUserId ?? cachedUserId,
              profile: existing?.profile ?? cachedProfile,
              relationship: existing?.relationship ?? cachedRelationship,
              profileFetchedAt: existing?.profileFetchedAt ?? Date.now(),
              timelines: {
                ...existing?.timelines,
                [targetMode]: {
                  tweets: nextTweets,
                  nextCursor: timeline.nextCursor,
                  fetchedAt: timeline.fetchedAt,
                },
              },
            }));
          }

          return {
            ...current,
            loadingTab: false,
            timelines: {
              ...current.timelines,
              [targetMode]: nextTweets,
            },
            cursors: {
              ...current.cursors,
              [targetMode]: timeline.nextCursor,
            },
            error: undefined,
          };
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load more posts.";
        setState((current) => {
          if (
            reqId !== requestRef.current ||
            current.username !== localUsername
          ) {
            return current;
          }

          return {
            ...current,
            loadingTab: false,
            error: message,
          };
        });
      }
    },
    [
      getTimeline,
      state.activeTab,
      state.cursors,
      state.profile,
      state.relationship,
      state.userId,
      state.username,
      writeCache,
    ]
  );

  const value = useMemo<TwitterProfileContextValue>(
    () => ({
      ...state,
      openProfile,
      closeProfile,
      loadMore,
      retryProfile,
      setTab,
      prefetchProfile,
      refreshProfileDisplay,
    }),
    [
      state,
      openProfile,
      closeProfile,
      loadMore,
      retryProfile,
      setTab,
      prefetchProfile,
      refreshProfileDisplay,
    ]
  );

  return (
    <TwitterProfileContext.Provider value={value}>
      {children}
    </TwitterProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(TwitterProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return ctx;
}
