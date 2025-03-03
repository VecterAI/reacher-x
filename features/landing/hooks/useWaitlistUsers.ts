"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";

export interface WaitlistUser {
  avatarUrl: string;
  displayName: string;
  username: string;
  verified: boolean;
}

export function useWaitlistUsers() {
  const twitterHandles = useQuery(api.waitlist.getTwitterHandles);
  const getTwitterProfile = useAction(api.socialdata.getTwitterProfile);
  const [profiles, setProfiles] = useState<WaitlistUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (twitterHandles === undefined) return; // Wait for data
      if (twitterHandles.length === 0) {
        setProfiles([]);
        setLoading(false);
        return;
      }
      try {
        const profilePromises = twitterHandles.map((twitter) =>
          getTwitterProfile({ twitter }).catch((error) => {
            console.error(`Error fetching ${twitter}:`, error);
            return null;
          })
        );
        const results = await Promise.all(profilePromises);
        const validProfiles = results.filter(
          (p): p is WaitlistUser => p !== null
        );
        setProfiles(validProfiles);
      } catch (error) {
        console.error("Unexpected error fetching profiles:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, [twitterHandles, getTwitterProfile]);

  return { profiles, loading };
}
