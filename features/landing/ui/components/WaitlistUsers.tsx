"use client";

import { useWaitlistUsers } from "@/features/landing/hooks/useWaitlistUsers";
import { AvatarStack } from "./AvatarStack";
import { AvatarStackSkeleton } from "./AvatarStackSkeleton";

interface WaitlistUsersProps {
  className?: string;
}

export function WaitlistUsers({ className }: WaitlistUsersProps) {
  const { profiles, loading, totalCount } = useWaitlistUsers();

  if (loading) {
    return <AvatarStackSkeleton className={className} />;
  }

  return (
    <AvatarStack
      users={profiles}
      className={className}
      totalCount={totalCount}
    />
  );
}
