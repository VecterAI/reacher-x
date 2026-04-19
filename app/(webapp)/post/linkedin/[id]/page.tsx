"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { base64UrlDecodeUtf8 } from "@/shared/lib/utils";
import { LinkedInPostThreadPanel } from "@/features/webapp/ui/components";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS } from "@/features/prospects/lib/uiPreviewData";

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Prefer navigation payload when present (base64-encoded)
  const navPost: UnifiedPost | null = React.useMemo(() => {
    const packed = searchParams.get("t");
    if (!packed) return null;
    try {
      const json = base64UrlDecodeUtf8(packed);
      return JSON.parse(json) as UnifiedPost;
    } catch {
      return null;
    }
  }, [searchParams]);

  const post = navPost;
  const previewScenarioKey = searchParams.get("preview");
  const previewScenario = previewScenarioKey
    ? UI_PREVIEW_LINKEDIN_THREAD_SCENARIOS[previewScenarioKey]
    : undefined;

  if (!post) {
    return (
      <div className="mx-4 mt-2 space-y-3">
        <div className="text-muted-foreground text-sm">Loading post...</div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <LinkedInPostThreadPanel
      post={post}
      onBack={() => router.back()}
      previewScenario={previewScenario}
    />
  );
}

export default function LinkedInPostDetailPage() {
  return <Inner />;
}
