"use client";

import { useState, useEffect } from "react";
import { useWaitlistUsers } from "@/features/landing/hooks/useWaitlistUsers";
import { WaitlistUsersMarquee } from "./WaitlistUsersMarquee";
import { AvatarStack } from "./AvatarStack";

interface WaitlistUsersProps {
  className?: string;
}

export function WaitlistUsers({ className }: WaitlistUsersProps) {
  const { profiles, loading } = useWaitlistUsers();
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 768); // Tailwind's 'md' breakpoint
    };
    handleResize(); // Set initial state on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize); // Cleanup
  }, []);

  if (loading) {
    return <div className={className}>Loading waitlist users...</div>;
  }

  return isSmallScreen ? (
    <AvatarStack users={profiles} className={className} />
  ) : (
    <WaitlistUsersMarquee profiles={profiles} className={className} />
  );
}
