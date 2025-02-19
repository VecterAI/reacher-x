"use client";

import * as React from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import Marquee from "react-fast-marquee";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/shared/lib/utils/utils";
import { WaitlistUserCard } from "./WaitlistUserCard";

// Define the shape of a Twitter profile
interface WaitlistUser {
  avatarUrl: string;
  displayName: string;
  username: string;
  verified: boolean;
}

// Define the props for the WaitlistUsersMarquee component
export interface WaitlistUsersMarqueeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

// Create the WaitlistUsersMarquee component as a forwardRef
export const WaitlistUsersMarquee = React.forwardRef<
  HTMLDivElement,
  WaitlistUsersMarqueeProps
>((props, ref) => {
  const { className, asChild, ...rest } = props;
  const Comp = asChild ? Slot : Marquee;

  // Fetch Twitter handles from the waitlist table
  const twitterHandles = useQuery(api.waitlist.getTwitterHandles);
  // Get the Convex action to fetch Twitter profiles
  const getTwitterProfile = useAction(api.socialdata.getTwitterProfile);
  // State to hold the fetched profiles
  const [profiles, setProfiles] = React.useState<WaitlistUser[]>([]);
  // State to manage loading
  const [loading, setLoading] = React.useState(true);

  // Effect to fetch profiles when twitterHandles changes
  React.useEffect(() => {
    const fetchProfiles = async () => {
      // Wait until twitterHandles is loaded
      if (twitterHandles === undefined) return;
      // If no handles, set loading to false and exit
      if (twitterHandles.length === 0) {
        setLoading(false);
        return;
      }
      try {
        // Fetch profiles concurrently, handling individual errors
        const profilePromises = twitterHandles.map((twitter) =>
          getTwitterProfile({ twitter }).catch((error) => {
            console.error(`Error fetching ${twitter}:`, error);
            return null;
          })
        );
        const results = await Promise.all(profilePromises);
        // Filter out any failed fetches
        const validProfiles = results.filter(
          (p): p is WaitlistUser => p !== null
        );
        setProfiles(validProfiles);
      } catch (error) {
        console.error("Unexpected error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, [twitterHandles, getTwitterProfile]);

  // Show loading state while fetching handles or profiles
  if (twitterHandles === undefined || loading) {
    return <div>Loading waitlist users...</div>; // Consider replacing with a skeleton loader
  }

  // Render the marquee with the fetched profiles
  return (
    <Comp
      gradient={false}
      speed={100}
      pauseOnHover={true}
      className={cn(className)}
      ref={ref}
      {...rest}
    >
      {profiles.map((profile) => (
        <WaitlistUserCard
          key={profile.username}
          avatarUrl={profile.avatarUrl}
          displayName={profile.displayName}
          username={profile.username}
          pro={profile.verified}
          className="mr-12"
        />
      ))}
    </Comp>
  );
});

// Set display name for debugging purposes
WaitlistUsersMarquee.displayName = "WaitlistUsersMarquee";
