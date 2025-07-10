import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

// Use basic middleware configuration
export default authkitMiddleware();

// Match against pages that require authentication
export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)",
    "/callback",
    "/login",
    "/logout",
  ],
};
