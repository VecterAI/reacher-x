import { Badge } from "@/shared/ui/components/Badge";
import { WaitlistUsers } from "@/features/landing/ui/components/WaitlistUsers";
import { WaitlistDrawer } from "@/features/landing/ui/components/WaitlistDrawer";
import { RecentThreads } from "@/features/landing/ui/components/RecentThreads";
import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-12 py-6 md:space-y-48 md:pb-52 md:pt-12">
      <section
        id="hero"
        aria-labelledby="hero-heading"
        className="px-4 md:px-28"
      >
        <Badge variant="outline">✶&nbsp;&nbsp;Launching April 2025</Badge>
        <hgroup className="mt-4 max-w-2xl space-y-4">
          <h1 id="hero-heading" className="text-4xl font-medium md:text-5xl">
            A search engine—to find customers.
          </h1>
          <p>Join the wait-list for early access and updates!</p>
        </hgroup>

        <WaitlistDrawer />

        <WaitlistUsers className="mt-6 md:mt-12" />
      </section>

      {/* <section
        id="vision"
        aria-labelledby="vision-heading"
        className="space-y-6 md:space-y-12"
      >
        <h2 id="vision-heading" className="text-3xl font-medium">
          Vision.
        </h2>
        <TweetCard
          size="lg"
          className="px-0"
          idStr={mockTweets[0].id_str}
          name={mockTweets[0].user.name}
          screenName={mockTweets[0].user.screen_name}
          profileImageUrlHttps={mockTweets[0].user.profile_image_url_https}
          verified={mockTweets[0].user.verified}
          tweetCreatedAt={mockTweets[0].tweet_created_at}
          fullText={mockTweets[0].full_text || ""}
          replyCount={mockTweets[0].reply_count}
          favoriteCount={mockTweets[0].favorite_count}
          bookmarkCount={mockTweets[0].bookmark_count}
          viewsCount={mockTweets[0].views_count}
          retweetCount={mockTweets[0].retweet_count}
          entities={mockTweets[0].entities}
          media={mockTweets[0].entities?.media || []}
        />
      </section> */}

      {/* <section aria-label="Key value props" className="mb-16 space-y-4 text-lg">
        <div className="text-5xl font-medium md:text-6xl">
          No upfront payments.
          <br />
          No hidden customers.
          <br />
          No waiting—just results!
        </div>
      </section> */}

      <section
        id="recent-thread"
        aria-labelledby="recent-thread-heading"
        className="space-y-6 @container md:space-y-12"
      >
        <div className="flex items-center justify-between px-4 md:px-28">
          <h2 id="recent-thread-heading" className="text-3xl font-medium">
            Recent threads.
          </h2>
          <Link
            href="/threads"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
        <RecentThreads className="px-0 md:px-28" size="lg" bordered={true} />
      </section>

      <section
        id="join-waitlist"
        aria-labelledby="waitlist-heading"
        className="px-4 md:px-28"
      >
        <h2 id="waitlist-heading" className="text-3xl font-medium">
          Join over 50 people already on the wait-list!
        </h2>

        <WaitlistDrawer />

        <WaitlistUsers className="mt-6 md:mt-12" />
      </section>
    </div>
  );
}
