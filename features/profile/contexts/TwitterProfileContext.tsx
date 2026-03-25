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
  HydratedTwitterProfilePayload,
  TwitterTimelineMode,
} from "@/shared/lib/twitter/hydration";

export type ProfileMode = TwitterTimelineMode;
export type ProfileUser = HydratedTwitterProfile;

type CachedTimelinePage = {
  tweets: Tweet[];
  nextCursor?: string;
  fetchedAt: number;
};

type ProfileCacheEntry = {
  profileUserId: string;
  profile: ProfileUser;
  profileFetchedAt: number;
  timelines: Partial<Record<ProfileMode, CachedTimelinePage>>;
};

interface ProfileState {
  isOpen: boolean;
  username?: string;
  userId?: string;
  profile?: ProfileUser;
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

function toCacheEntry(
  payload: HydratedTwitterProfilePayload
): ProfileCacheEntry {
  return {
    profileUserId: payload.profileUserId,
    profile: payload.profile,
    profileFetchedAt: payload.timeline.fetchedAt,
    timelines: {
      [payload.timeline.mode]: {
        tweets: payload.timeline.tweets,
        nextCursor: payload.timeline.nextCursor,
        fetchedAt: payload.timeline.fetchedAt,
      },
    },
  };
}

function getFreshCachedPage(
  entry: ProfileCacheEntry | undefined,
  mode: ProfileMode
): CachedTimelinePage | undefined {
  const page = entry?.timelines[mode];
  return page && isFresh(page.fetchedAt) ? page : undefined;
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

  const getHydratedProfile = useAction(api.x.getHydratedTwitterProfile);
  const getHydratedTimeline = useAction(api.x.getHydratedTwitterTimeline);

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
        const payload = await getHydratedProfile({ username, mode: "posts" });
        cacheRef.current.set(username, toCacheEntry(payload));
      } catch {
        // Prefetch is opportunistic; ignore failures.
      }
    },
    [getHydratedProfile]
  );

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
      const cached = cacheRef.current.get(username);
      const cachedPage = getFreshCachedPage(cached, tab);

      if (cached && isFresh(cached.profileFetchedAt) && cachedPage) {
        setState({
          isOpen: true,
          username,
          userId: cached.profileUserId,
          profile: cached.profile,
          loadingProfile: false,
          activeTab: tab,
          loadingTab: false,
          timelines: { [tab]: cachedPage.tweets },
          cursors: { [tab]: cachedPage.nextCursor },
          error: undefined,
        });
        return;
      }

      setState({
        isOpen: true,
        username,
        userId: undefined,
        profile: undefined,
        loadingProfile: true,
        activeTab: tab,
        loadingTab: true,
        timelines: {},
        cursors: {},
        error: undefined,
      });

      try {
        const payload = await getHydratedProfile({ username, mode: tab });
        cacheRef.current.set(username, toCacheEntry(payload));
        setState((current) => {
          if (reqId !== requestRef.current || current.username !== username) {
            return current;
          }

          return {
            ...current,
            userId: payload.profileUserId,
            profile: payload.profile,
            loadingProfile: false,
            loadingTab: false,
            timelines: { [tab]: payload.timeline.tweets },
            cursors: { [tab]: payload.timeline.nextCursor },
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
            profile: undefined,
            userId: undefined,
            loadingProfile: false,
            loadingTab: false,
            timelines: {},
            cursors: {},
            error: message,
          };
        });
      }
    },
    [getHydratedProfile]
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
        const timeline = await getHydratedTimeline({
          username: localUsername,
          userId: state.userId,
          mode,
        });

        const cachedEntry = cacheRef.current.get(localUsername);
        const cachedProfile = cachedEntry?.profile ?? state.profile;
        const cachedUserId = cachedEntry?.profileUserId ?? state.userId;
        if (cachedProfile && cachedUserId) {
          writeCache(localUsername, (existing) => ({
            profileUserId: existing?.profileUserId ?? cachedUserId,
            profile: existing?.profile ?? cachedProfile,
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
      getHydratedTimeline,
      state.profile,
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
        const timeline = await getHydratedTimeline({
          username: localUsername,
          userId: state.userId,
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
          const cachedUserId = cachedEntry?.profileUserId ?? state.userId;
          if (cachedProfile && cachedUserId) {
            writeCache(localUsername, (existing) => ({
              profileUserId: existing?.profileUserId ?? cachedUserId,
              profile: existing?.profile ?? cachedProfile,
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
      getHydratedTimeline,
      state.activeTab,
      state.cursors,
      state.profile,
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
    }),
    [
      state,
      openProfile,
      closeProfile,
      loadMore,
      retryProfile,
      setTab,
      prefetchProfile,
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
