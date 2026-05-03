"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { logger } from "@/shared/lib/logger";
import { WaitlistUser } from "../types";
import { useQueryWithStatus } from "@/shared/hooks";

type TwitterProfileSummary = {
  profile_image_url_https: string;
  name: string;
  screen_name: string;
  verified?: boolean;
};

export function useWaitlistUsers() {
  const twitterHandlesQuery = useQueryWithStatus(
    api.waitlist.getTwitterHandles
  );
  const twitterHandles = twitterHandlesQuery.data;
  const totalCountQuery = useQueryWithStatus(api.waitlist.getWaitlistCount);
  const totalCount = totalCountQuery.data;
  const getTwitterProfile = useAction(api.socialapi.getTwitterProfile);
  const [profiles, setProfiles] = useState<WaitlistUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (twitterHandlesQuery.isPending) return;
      if (twitterHandlesQuery.isError) {
        logger.error(
          "Failed to load waitlist users:",
          twitterHandlesQuery.error
        );
        setProfiles([]);
        setLoading(false);
        return;
      }
      const handles = twitterHandles ?? [];
      if (handles.length === 0) {
        setProfiles([]);
        setLoading(false);
        return;
      }
      try {
        const profilePromises = handles.map((twitter: string) =>
          getTwitterProfile({ twitter }).catch((error) => {
            logger.error(`Error fetching ${twitter}:`, error);
            return null;
          })
        );
        const results = await Promise.all(profilePromises);
        const validProfiles = results
          .filter(
            (p: TwitterProfileSummary | null): p is TwitterProfileSummary =>
              p !== null
          )
          .map((p: TwitterProfileSummary) => ({
            profile_image_url_https: p.profile_image_url_https,
            name: p.name,
            screen_name: p.screen_name,
            verified: Boolean(p.verified),
          })) as WaitlistUser[];
        setProfiles(validProfiles);
      } catch (error) {
        logger.error("Unexpected error fetching profiles:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, [
    getTwitterProfile,
    twitterHandles,
    twitterHandlesQuery.error,
    twitterHandlesQuery.isError,
    twitterHandlesQuery.isPending,
  ]);

  return {
    profiles,
    loading,
    totalCount: totalCount ?? 0,
    isCountLoading: totalCountQuery.isPending,
  };
}
