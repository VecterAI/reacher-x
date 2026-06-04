import { Suspense } from "react";
import { ThreadCard } from "@/features/threads/ui/components/ThreadCard";
import type { Tweet } from "@/features/threads/types";
import { SocialProofSectionSkeleton } from "./SocialProofSectionSkeleton";

export function SocialProofSection({
  tweetsPromise,
}: {
  tweetsPromise: Promise<Tweet[]>;
}) {
  return (
    <section
      aria-labelledby="social-proof-heading"
      className="px-4 py-16 md:py-24"
    >
      <h2
        id="social-proof-heading"
        className="font-pixel-square mb-12 text-center text-4xl font-bold md:mb-16 md:text-5xl"
      >
        You&apos;ll love Agent. <br className="hidden md:block" />
        Others already do.
      </h2>

      <Suspense fallback={<SocialProofSectionSkeleton />}>
        <SocialProofSectionContent tweetsPromise={tweetsPromise} />
      </Suspense>
    </section>
  );
}

async function SocialProofSectionContent({
  tweetsPromise,
}: {
  tweetsPromise: Promise<Tweet[]>;
}) {
  const tweets = await tweetsPromise;

  if (tweets.length === 0) {
    return (
      <p className="text-muted-foreground text-center">
        Social proof will appear here as fresh public testimonials become
        available.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {tweets.map((tweet) => (
        <ThreadCard
          key={tweet.id_str}
          staticTweet={tweet}
          size="md"
          className="[&_[data-orientation=vertical]]:hidden"
        />
      ))}
    </div>
  );
}
