import { redirect } from "next/navigation";

export const GET = async () => {
  // The middleware will handle the authentication and set the session cookie
  // After successful authentication, redirect to the home page
  return redirect("/");
};
