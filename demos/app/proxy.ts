import { NextResponse, type NextRequest } from "next/server";
import { DEMO_SETUP_THREAD_ID } from "./runtime/scenarios/setupHelpers";

// Seed the local thread before any real setup components mount. This prevents
// the shell and chat from competing to normalize an empty setup URL.
export function proxy(request: NextRequest) {
  if (
    !request.nextUrl.searchParams.get("threadId") ||
    request.nextUrl.searchParams.has("scenario")
  ) {
    const url = request.nextUrl.clone();
    if (!url.searchParams.get("threadId"))
      url.searchParams.set("threadId", DEMO_SETUP_THREAD_ID);
    url.searchParams.delete("scenario");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: "/agent/setup" };
