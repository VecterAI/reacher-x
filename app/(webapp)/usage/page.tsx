import { cookies } from "next/headers";
import { UsagePage } from "@/features/usage/ui/UsagePage";
import {
  parseUsageLayoutCache,
  USAGE_LAYOUT_CACHE_KEY,
} from "@/features/usage/lib/layoutCache";

export default async function UsageRoutePage() {
  const cookieStore = await cookies();
  const initialLayoutCache = parseUsageLayoutCache(
    cookieStore.get(USAGE_LAYOUT_CACHE_KEY)?.value
  );

  return <UsagePage initialLayoutCache={initialLayoutCache} />;
}
