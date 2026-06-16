import { signOut } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { useLogger, withEvlog } from "@/shared/lib/logging/next";

export const GET = withEvlog(async () => {
  const log = useLogger();
  log.set({
    auth: {
      action: "logout",
      provider: "workos",
    },
    operation: "logout_route",
  });

  await signOut();
  redirect("/");
});
