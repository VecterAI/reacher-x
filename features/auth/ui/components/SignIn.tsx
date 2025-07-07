"use client";

import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { Button } from "@/shared/ui/components/Button";

export function SignIn() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <Button asChild>
          <a href="/login">Sign in with Google</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p>Welcome back, {user.firstName || user.email}!</p>
      <Button asChild variant="outline">
        <a href="/logout">Sign out</a>
      </Button>
    </div>
  );
}
