"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useRef,
  useEffect,
} from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Tweet, User } from "@/features/threads/types";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";

export type ProfileMode = "posts" | "replies" | "quotes";

// Module-level cache constants and helpers so Hooks don't depend on them
const PROFILE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TIMELINE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 50;
const LS_KEY = "rx_profile_cache_v1";

function isFresh(updatedAt: number, ttl: number) {
  return getCurrentUTCTimestamp() - updatedAt < ttl;
}

type UrlEntity = {
  url: string;
  expanded_url: string;
  display_url: string;
  indices: [number, number];
};

export type ProfileUser = User & {
  username?: string;
  profile_banner_url?: string;
  banner_url?: string;
  entities?: {
    description?: {
      urls?: UrlEntity[];
    };
    url?: {
      urls?: UrlEntity[];
    };
  };
};

interface ProfileState {
  isOpen: boolean;
  username?: string;
  userId?: string | number;
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
    /**
     * Optional seed profile to enable instant paint without a request.
     * Benefit: avoids initial flicker by using known user data from tweet cards.
     */
    seedProfile?: ProfileUser;
  }) => Promise<void>;
  closeProfile: () => void;
  loadMore: (mode?: ProfileMode) => Promise<void>;
  setTab: (mode: ProfileMode) => Promise<void>;
  /**
   * Prefetch profile into cache (no UI changes). Useful for hover/focus intent.
   * Benefit: makes subsequent openProfile() instant while keeping network usage low.
   */
  prefetchProfile: (username: string) => Promise<void>;
}

const TwitterProfileContext = createContext<
  TwitterProfileContextValue | undefined
>(undefined);

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

  const getProfile = useAction(api.socialapi.getTwitterProfile);
  const searchTimeline = useAction(api.socialapi.searchUserTimeline);

  /**
   * In-memory LRU cache with TTLs
   * - Purpose: eliminate redundant profile/timeline fetches during a session
   * - Benefit: instant opens and tab switches; SWR background refresh ensures freshness
   */
  type CachedProfile = {
    data: ProfileUser;
    updatedAt: number;
    isPartial?: boolean;
  };
  type CachedTimeline = {
    data: Tweet[];
    next_cursor?: string;
    updatedAt: number;
  };
  type ProfileCacheEntry = {
    profile?: CachedProfile;
    timelines: Partial<Record<ProfileMode, CachedTimeline | undefined>>;
  };

  const cacheRef = useRef<Map<string, ProfileCacheEntry>>(new Map());
  const inFlightProfile = useRef<Map<string, Promise<ProfileUser>>>(new Map());
  const inFlightTimeline = useRef<
    Map<string, Promise<{ tweets: Tweet[]; next_cursor?: string }>>
  >(new Map());

  const touchLRU = useCallback((username: string, entry: ProfileCacheEntry) => {
    const cache = cacheRef.current;
    if (cache.has(username)) cache.delete(username);
    cache.set(username, entry);
    if (cache.size > MAX_CACHE_ENTRIES) {
      const firstKey = cache.keys().next().value as string | undefined;
      if (firstKey) cache.delete(firstKey);
    }
  }, []);

  // Persist a compact profile-only snapshot to localStorage for warm starts
  const persistProfilesToLocalStorage = useCallback(() => {
    try {
      const payload: Record<string, { profile?: CachedProfile }> = {};
      let count = 0;
      // Store up to 20 profiles to keep storage small
      const MAX_PERSIST = 20;
      for (const [key, value] of Array.from(
        cacheRef.current.entries()
      ).reverse()) {
        payload[key] = { profile: value.profile };
        count++;
        if (count >= MAX_PERSIST) break;
      }
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {}
  }, []);

  // Hydrate from localStorage on mount (profile only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const json = JSON.parse(raw) as Record<
        string,
        { profile?: CachedProfile }
      >;
      const map = cacheRef.current;
      Object.entries(json).forEach(([username, { profile }]) => {
        if (!profile) return;
        // Only keep entries that are still within TTL
        if (isFresh(profile.updatedAt, PROFILE_TTL_MS)) {
          map.set(username, { profile, timelines: {} });
        }
      });
    } catch {}
  }, []);

  const fetchProfile = useCallback(
    async (username: string): Promise<ProfileUser> => {
      const inflight = inFlightProfile.current.get(username);
      if (inflight) return inflight;
      const p = (async () => {
        const profile = (await getProfile({
          twitter: username,
        })) as ProfileUser;
        const entry = cacheRef.current.get(username) || { timelines: {} };
        entry.profile = { data: profile, updatedAt: getCurrentUTCTimestamp() };
        touchLRU(username, entry);
        // Persist profile-only snapshot for warm start
        persistProfilesToLocalStorage();
        return profile;
      })();
      inFlightProfile.current.set(username, p);
      try {
        return await p;
      } finally {
        inFlightProfile.current.delete(username);
      }
    },
    [getProfile, touchLRU, persistProfilesToLocalStorage]
  );

  const fetchTimeline = useCallback(
    async (
      username: string,
      mode: ProfileMode,
      cursor?: string
    ): Promise<{ tweets: Tweet[]; next_cursor?: string }> => {
      const key = `${username}:${mode}:${cursor || ""}`;
      const inflight = inFlightTimeline.current.get(key);
      if (inflight) return inflight;
      const p = (async () => {
        const data = await searchTimeline({ username, mode, cursor });
        const cacheEntry = cacheRef.current.get(username) || { timelines: {} };
        if (!cursor) {
          // First page replaces; subsequent pages append handled by loadMore
          cacheEntry.timelines[mode] = {
            data: (data.tweets || []) as Tweet[],
            next_cursor: data.next_cursor,
            updatedAt: getCurrentUTCTimestamp(),
          };
          touchLRU(username, cacheEntry);
        }
        return {
          tweets: (data.tweets || []) as Tweet[],
          next_cursor: data.next_cursor,
        };
      })();
      inFlightTimeline.current.set(key, p);
      try {
        return await p;
      } finally {
        inFlightTimeline.current.delete(key);
      }
    },
    [searchTimeline, touchLRU]
  );

  const prefetchProfile = useCallback(
    async (username: string) => {
      const cached = cacheRef.current.get(username)?.profile;
      if (cached && isFresh(cached.updatedAt, PROFILE_TTL_MS)) return;
      try {
        await fetchProfile(username);
      } catch {}
    },
    [fetchProfile]
  );

  const openProfile = useCallback(
    async ({
      username,
      initialTab,
      seedProfile,
    }: {
      username: string;
      initialTab?: ProfileMode;
      seedProfile?: ProfileUser;
    }) => {
      const reqId = ++requestRef.current;
      const tab = initialTab || "posts";

      const cached = cacheRef.current.get(username);
      const cachedProfile = cached?.profile;
      const cachedTimeline = cached?.timelines?.[tab];

      // If a seed profile is provided, only install if we DON'T already have a fresh full profile.
      if (seedProfile) {
        const existing = cacheRef.current.get(username)?.profile;
        const hasFreshFull =
          existing &&
          !existing.isPartial &&
          isFresh(existing.updatedAt, PROFILE_TTL_MS);
        if (!hasFreshFull) {
          const entry = cacheRef.current.get(username) || { timelines: {} };
          entry.profile = {
            data: seedProfile,
            updatedAt: getCurrentUTCTimestamp(),
            isPartial: true,
          };
          touchLRU(username, entry);
        }
      }
      const freshProfile =
        cachedProfile &&
        !cachedProfile.isPartial &&
        isFresh(cachedProfile.updatedAt, PROFILE_TTL_MS)
          ? cachedProfile.data
          : undefined;
      const freshTimeline =
        cachedTimeline && isFresh(cachedTimeline.updatedAt, TIMELINE_TTL_MS)
          ? {
              tweets: cachedTimeline.data,
              next_cursor: cachedTimeline.next_cursor,
            }
          : undefined;

      // If both fresh, render immediately
      if (freshProfile && freshTimeline) {
        const userId =
          (freshProfile as ProfileUser | undefined)?.id ||
          (freshProfile as ProfileUser | undefined)?.id_str;
        setState((s) => ({
          ...s,
          isOpen: true,
          username,
          profile: freshProfile,
          userId,
          loadingProfile: false,
          activeTab: tab,
          loadingTab: false,
          timelines: { ...s.timelines, [tab]: freshTimeline.tweets },
          cursors: { ...s.cursors, [tab]: freshTimeline.next_cursor },
          error: undefined,
        }));
        return;
      }

      // Otherwise, show a single loading phase and resolve both together so header+timeline appear in sync
      setState((s) => ({
        ...s,
        isOpen: true,
        username,
        profile: undefined,
        userId: undefined,
        loadingProfile: true,
        activeTab: tab,
        loadingTab: true,
        timelines: {},
        cursors: {},
        error: undefined,
      }));

      try {
        const profilePromise = freshProfile
          ? Promise.resolve(freshProfile)
          : fetchProfile(username);
        const timelinePromise = freshTimeline
          ? Promise.resolve(freshTimeline)
          : fetchTimeline(username, tab);
        const [profile, data] = await Promise.all([
          profilePromise,
          timelinePromise,
        ]);
        setState((s) => {
          if (s.username !== username || reqId !== requestRef.current) return s;
          const userId =
            (profile as ProfileUser | undefined)?.id ||
            (profile as ProfileUser | undefined)?.id_str;
          return {
            ...s,
            profile,
            userId,
            loadingProfile: false,
            activeTab: tab,
            loadingTab: false,
            timelines: { ...s.timelines, [tab]: data.tweets },
            cursors: { ...s.cursors, [tab]: data.next_cursor },
          };
        });
      } catch (e: unknown) {
        setState((s) => {
          if (s.username !== username || reqId !== requestRef.current) return s;
          return {
            ...s,
            loadingProfile: false,
            loadingTab: false,
            error:
              (typeof e === "object" && e && "message" in e
                ? String((e as { message?: string }).message)
                : undefined) || "Failed to load profile",
          };
        });
      }
    },
    [fetchProfile, fetchTimeline, touchLRU]
  );

  const closeProfile = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }));
  }, []);

  const setTab = useCallback(
    async (mode: ProfileMode) => {
      if (!state.username) return;
      const localUsername = state.username;
      const cached = cacheRef.current.get(localUsername)?.timelines?.[mode];
      const fresh = cached && isFresh(cached.updatedAt, TIMELINE_TTL_MS);
      if (fresh) {
        setState((s) => ({
          ...s,
          activeTab: mode,
          loadingTab: false,
          timelines: { ...s.timelines, [mode]: cached!.data },
          cursors: { ...s.cursors, [mode]: cached!.next_cursor },
        }));
        // Optional SWR background refresh if about to expire
        if (!isFresh(cached!.updatedAt, TIMELINE_TTL_MS / 2)) {
          fetchTimeline(localUsername, mode).catch(() => {});
        }
        return;
      }

      setState((s) => ({ ...s, activeTab: mode, loadingTab: true }));
      const data = await fetchTimeline(localUsername, mode);
      setState((s) => {
        if (s.username !== localUsername) return s;
        return {
          ...s,
          loadingTab: false,
          timelines: { ...s.timelines, [mode]: data.tweets || [] },
          cursors: { ...s.cursors, [mode]: data.next_cursor },
        };
      });
    },
    [fetchTimeline, state.username]
  );

  const loadMore = useCallback(
    async (mode?: ProfileMode) => {
      const target = mode || state.activeTab;
      const cursor = state.cursors[target];
      if (!cursor || !state.username) return;
      const localUsername = state.username;
      setState((s) => ({ ...s, loadingTab: true }));
      const data = await searchTimeline({
        username: localUsername,
        mode: target,
        cursor,
      });
      setState((s) => {
        if (s.username !== localUsername) return s;
        // Append to cache as well
        const entry = cacheRef.current.get(localUsername) || { timelines: {} };
        const prev = entry.timelines[target]?.data || [];
        entry.timelines[target] = {
          data: [...prev, ...(data.tweets || [])],
          next_cursor: data.next_cursor,
          updatedAt: getCurrentUTCTimestamp(),
        };
        touchLRU(localUsername, entry);
        return {
          ...s,
          loadingTab: false,
          timelines: {
            ...s.timelines,
            [target]: [...(s.timelines[target] || []), ...(data.tweets || [])],
          },
          cursors: { ...s.cursors, [target]: data.next_cursor },
        };
      });
    },
    [searchTimeline, state.activeTab, state.cursors, state.username, touchLRU]
  );

  const value = useMemo<TwitterProfileContextValue>(
    () => ({
      ...state,
      openProfile,
      closeProfile,
      loadMore,
      setTab,
      prefetchProfile,
    }),
    [state, openProfile, closeProfile, loadMore, setTab, prefetchProfile]
  );

  return (
    <TwitterProfileContext.Provider value={value}>
      {children}
    </TwitterProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(TwitterProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
