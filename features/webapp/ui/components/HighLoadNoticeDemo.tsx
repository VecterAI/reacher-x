"use client";

import { useSearchParams } from "next/navigation";
import { X_PROFILE_URL } from "@/features/landing/lib/communityUrls";
import {
  HighLoadNotice,
  type HighLoadNoticeState,
} from "@/shared/ui/components/HighLoadNotice";

/**
 * TEMPORARY demo wiring for the high-load banner. Remove this file and the
 * call site in WebAppChromeScaffold together with
 * NEXT_PUBLIC_HIGH_LOAD_NOTICE_DEMO once the real trigger is integrated.
 * The env check lives inline in WebAppChromeScaffold (server component).
 */

/**
 * Renders the banner in its real slot above page content. Append
 * ?highLoad=slow to preview the "slower than usual" copy.
 */
export function HighLoadNoticeDemo() {
  const searchParams = useSearchParams();
  const state: HighLoadNoticeState =
    searchParams.get("highLoad") === "slow" ? "slow" : "queued";

  return <HighLoadNotice state={state} helpHref={X_PROFILE_URL} />;
}
