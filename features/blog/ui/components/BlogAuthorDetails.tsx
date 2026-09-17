"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import { BLOG_AUTHOR } from "../../lib/blogHelpers";
import {
  BLOG_AUTHOR_FALLBACK,
  type BlogAuthorProfile,
} from "../../lib/blogAuthorHelpers";

const loadedAuthorImages = new Set<string>();
const imageListeners = new Set<() => void>();
const subscribeToImages = (listener: () => void) => {
  imageListeners.add(listener);
  return () => {
    imageListeners.delete(listener);
  };
};
const imageServerSnapshot = () => false;

function BlogAuthorAvatar({ src }: { src: string }) {
  const loaded = useSyncExternalStore(
    subscribeToImages,
    () => loadedAuthorImages.has(src),
    imageServerSnapshot
  );
  const [failed, setFailed] = useState(false);
  const rememberLoaded = () => {
    if (loadedAuthorImages.has(src)) return;
    loadedAuthorImages.add(src);
    imageListeners.forEach((listener) => listener());
  };

  return (
    <div className="relative size-4 shrink-0">
      {!loaded && (
        <Skeleton className="size-4 rounded-full" aria-hidden="true" />
      )}
      {src && !failed && (
        <Image
          src={src}
          width={16}
          height={16}
          alt=""
          className={`absolute inset-0 size-4 rounded-full object-cover ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={rememberLoaded}
          onError={() => {
            loadedAuthorImages.delete(src);
            imageListeners.forEach((listener) => listener());
            setFailed(true);
          }}
        />
      )}
    </div>
  );
}

export function BlogAuthorDetails({
  profile = BLOG_AUTHOR_FALLBACK,
}: {
  profile?: BlogAuthorProfile;
}) {
  return (
    <div
      className="text-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5"
      data-blog-author
    >
      <a
        href={profile.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`View ${profile.name} on X`}
        className="focus-visible:outline-ring relative z-10 inline-flex min-w-0 items-center gap-2 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <BlogAuthorAvatar key={profile.image} src={profile.image} />
        <span className="inline-flex min-w-0 items-center gap-0.5">
          <span className="min-w-0 break-words">{profile.name}</span>
          <span className="size-3.5 shrink-0" data-blog-author-badge>
            {profile.verified && (
              <NewReleasesIcon
                className="size-full fill-current"
                role="img"
                aria-label="Verified on X"
              />
            )}
          </span>
        </span>
      </a>
      <span className="text-muted-foreground inline-flex items-center gap-2">
        <span aria-hidden="true">·</span>
        <span>{BLOG_AUTHOR.role}</span>
      </span>
    </div>
  );
}
