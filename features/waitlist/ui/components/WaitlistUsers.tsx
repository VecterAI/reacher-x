"use client";

import { useWaitlistUsers } from "@/features/waitlist/hooks/useWaitlistUsers";
import { AvatarStack } from "@/shared/ui/components/AvatarStack";
import { AvatarStackSkeleton } from "@/features/landing/ui/components/AvatarStackSkeleton";

interface WaitlistUsersProps {
  className?: string;
}

export function WaitlistUsers({ className }: WaitlistUsersProps) {
  const { profiles, loading } = useWaitlistUsers();

  if (loading) {
    return <AvatarStackSkeleton className={className} />;
  }

  // Map WaitlistUser to AvatarStackParticipant
  const participants = profiles.map((user) => ({
    name: user.name,
    avatarUrl: user.profile_image_url_https,
  }));

  return (
    <AvatarStack
      participants={participants}
      maxVisible={4}
      size="md"
      className={className}
    />
  );
}
