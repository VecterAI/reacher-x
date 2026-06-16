import { redirect } from "next/navigation";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { useLogger, withEvlog } from "@/shared/lib/logging/next";

export const GET = withEvlog(async () => {
  const log = useLogger();
  log.set({
    auth: {
      action: "login_redirect",
      provider: "workos",
    },
    operation: "login_route",
  });

  const authorizationUrl = await getSignInUrl();
  redirect(authorizationUrl);
});
