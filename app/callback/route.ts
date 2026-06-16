import { handleAuth } from "@workos-inc/authkit-nextjs";
import { NextRequest } from "next/server";
import { useLogger, withEvlog } from "@/shared/lib/logging/next";

const authHandler = handleAuth();

export const GET = withEvlog(async (request: NextRequest) => {
  const log = useLogger();
  log.set({
    auth: {
      action: "callback",
      provider: "workos",
    },
    operation: "auth_callback_route",
  });

  return authHandler(request);
});
