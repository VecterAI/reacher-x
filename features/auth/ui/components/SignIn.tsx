"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/shared/ui/components/Button";

export function SignIn() {
  const { signIn, signOut } = useAuthActions();

  return (
    <>
      <AuthLoading>
        <p>Loading...</p>
      </AuthLoading>
      <Authenticated>
        <Button onClick={() => void signOut()}>Sign out</Button>
      </Authenticated>
      <Unauthenticated>
        <Button onClick={() => void signIn("google")}>
          Sign in with Google
        </Button>
      </Unauthenticated>
    </>
  );
}
