import { signOut } from "@workos-inc/authkit-nextjs";
import { useLogger, withEvlog } from "@/shared/lib/logging/next";

export const POST = withEvlog(async () => {
  const log = useLogger();
  log.set({
    auth: {
      action: "logout",
      provider: "workos",
    },
    operation: "logout_route",
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for logout redirects.");
  }

  await signOut({ returnTo: new URL("/", siteUrl).toString() });
});
