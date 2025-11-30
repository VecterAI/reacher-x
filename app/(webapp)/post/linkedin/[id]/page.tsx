"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { base64UrlDecodeUtf8 } from "@/shared/lib/utils/encoding";
import {
  PageHeader,
  PageLayout,
  PageContent,
} from "@/features/webapp/ui/components";
import { LinkedInPostCard } from "@/features/webapp/ui/components/LinkedInPostCard";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { Skeleton } from "@/shared/ui/components/Skeleton";

function Inner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = params.id;

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

  return (
    <PageLayout>
      <PageHeader title="Post" onBack={() => router.back()} />
      <PageContent className="mx-4 mt-2 space-y-2 pb-4">
        {!post ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Loading post...</div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-24 w-full rounded-md" />
              </div>
            </div>
          </div>
        ) : (
          <LinkedInPostCard
            post={post}
            showFullContent={true}
            disableExternalNavigation
          />
        )}
      </PageContent>
    </PageLayout>
  );
}

export default function LinkedInPostDetailPage() {
  return <Inner />;
}
