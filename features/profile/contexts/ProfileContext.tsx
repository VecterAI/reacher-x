"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Tweet, User } from "@/features/threads/types";

export type ProfileMode = "posts" | "replies" | "quotes";

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

interface ProfileContextValue extends ProfileState {
  openProfile: (params: {
    username: string;
    initialTab?: ProfileMode;
  }) => Promise<void>;
  closeProfile: () => void;
  loadMore: (mode?: ProfileMode) => Promise<void>;
  setTab: (mode: ProfileMode) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(
  undefined
);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProfileState>({
    isOpen: false,
    loadingProfile: false,
    activeTab: "posts",
    loadingTab: false,
    cursors: {},
    timelines: {},
  });

  const getProfile = useAction(api.socialapi.getTwitterProfile);
  const searchTimeline = useAction(api.socialapi.searchUserTimeline);

  const openProfile = useCallback(
    async ({
      username,
      initialTab,
    }: {
      username: string;
      initialTab?: ProfileMode;
    }) => {
      setState((s) => ({
        ...s,
        isOpen: true,
        username,
        loadingProfile: true,
        error: undefined,
      }));
      try {
        const profile = (await getProfile({
          twitter: username,
        })) as ProfileUser;
        const userId = profile?.id || profile?.id_str;
        setState((s) => ({ ...s, profile, userId, loadingProfile: false }));
        const tab = initialTab || "posts";
        await (async () => {
          setState((s) => ({ ...s, activeTab: tab, loadingTab: true }));
          const data = await searchTimeline({
            username,
            mode: tab,
          });
          setState((s) => ({
            ...s,
            activeTab: tab,
            loadingTab: false,
            timelines: {
              ...s.timelines,
              [tab]: (data.tweets || []) as Tweet[],
            },
            cursors: { ...s.cursors, [tab]: data.next_cursor },
          }));
        })();
      } catch (e: unknown) {
        setState((s) => ({
          ...s,
          loadingProfile: false,
          error:
            (typeof e === "object" && e && "message" in e
              ? String((e as { message?: string }).message)
              : undefined) || "Failed to load profile",
        }));
      }
    },
    [getProfile, searchTimeline]
  );

  const closeProfile = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }));
  }, []);

  const setTab = useCallback(
    async (mode: ProfileMode) => {
      if (!state.username) return;
      setState((s) => ({ ...s, activeTab: mode, loadingTab: true }));
      const data = await searchTimeline({ username: state.username, mode });
      setState((s) => ({
        ...s,
        loadingTab: false,
        timelines: { ...s.timelines, [mode]: data.tweets || [] },
        cursors: { ...s.cursors, [mode]: data.next_cursor },
      }));
    },
    [searchTimeline, state.username]
  );

  const loadMore = useCallback(
    async (mode?: ProfileMode) => {
      const target = mode || state.activeTab;
      const cursor = state.cursors[target];
      if (!cursor || !state.username) return;
      setState((s) => ({ ...s, loadingTab: true }));
      const data = await searchTimeline({
        username: state.username,
        mode: target,
        cursor,
      });
      setState((s) => ({
        ...s,
        loadingTab: false,
        timelines: {
          ...s.timelines,
          [target]: [...(s.timelines[target] || []), ...(data.tweets || [])],
        },
        cursors: { ...s.cursors, [target]: data.next_cursor },
      }));
    },
    [searchTimeline, state.activeTab, state.cursors, state.username]
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      ...state,
      openProfile,
      closeProfile,
      loadMore,
      setTab,
    }),
    [state, openProfile, closeProfile, loadMore, setTab]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
