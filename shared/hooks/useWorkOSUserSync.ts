"use client";

import { useAuth } from "@workos-inc/authkit-nextjs/components";

export function useWorkOSUserSync() {
  const { user, loading } = useAuth();

  return { user, loading };
}
