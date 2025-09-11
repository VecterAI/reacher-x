"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/utils/utils";
import { fetchOpenGraph, OpenGraphData } from "@/shared/lib/utils/opengraph";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Button } from "@/shared/ui/components/Button";
import { CloseIcon } from "@/shared/ui/components/icons";
import Image from "next/image";

interface OpenGraphPreviewProps {
  url: string;
  className?: string;
  onRemove?: () => void;
}

export function OpenGraphPreview({
  url,
  className,
  onRemove,
}: OpenGraphPreviewProps) {
  const [data, setData] = useState<OpenGraphData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const og = await fetchOpenGraph(url);
      if (active) setData(og);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [url]);

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div
          className="relative w-full overflow-hidden rounded-md"
          style={{ aspectRatio: "16 / 9" }}
        >
          <Skeleton className="absolute inset-0 h-full w-full" />
        </div>
        <div className="mt-2 flex items-start gap-4">
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-1 h-3 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || (!data.image && !data.title)) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Media Preview - matching MediaUploadSection design */}
      <div
        className="relative w-full overflow-hidden rounded-md"
        style={{ aspectRatio: "16 / 9" }}
      >
        {data.image && (
          <Image
            src={data.image}
            alt={data.title ?? "preview"}
            fill
            className="object-cover"
            sizes="100vw"
          />
        )}

        {/* Remove Button - matching MediaUploadSection */}
        {onRemove && (
          <Button
            variant="outline"
            size="xsIcon"
            onClick={onRemove}
            className="absolute right-2 top-2"
          >
            <CloseIcon className="fill-current" />
          </Button>
        )}
      </div>

      {/* Content - matching MediaUploadSection layout */}
      <div className="mt-2 flex items-start gap-4">
        <div className="flex-1">
          {data.siteName && (
            <div className="text-[11px] uppercase text-muted-foreground">
              {data.siteName}
            </div>
          )}
          {data.title && (
            <div className="text-sm font-medium">{data.title}</div>
          )}
          {data.description && (
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {data.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
