// app/(landing)/threads/[threadId]/page.tsx
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { TweetCard } from "@/features/landing/ui/components/TweetCard";
import { UserProfileCard } from "@/features/landing/ui/components/UserProfileCard";
import { Separator } from "@/shared/ui/components/Separator";
import { WaitlistDrawer } from "@/features/landing/ui/components/WaitlistDrawer";
import { WaitlistUsers } from "@/features/landing/ui/components/WaitlistUsers";
import { Badge } from "@/shared/ui/components/Badge";
import { RecentThreads } from "@/features/landing/ui/components/RecentThreads";
import { Thread } from "../types";
import Link from "next/link";
import { WaitlistSection } from "@/features/landing/ui/components/WaitlistSection";
import { getRecentThreads } from "@/lib/getRecentThreads";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

export default async function ThreadDetailPage(props: {
  params: Promise<{ threadId: string }>;
}) {
  const params = await props.params;
  const { threadId } = params;
  const recentThreads = await getRecentThreads();

  // Fetch thread data and thread IDs on the server
  const thread = (await convex.query(api.socialdata.getThreadById, {
    threadId,
  })) as Thread | null;
  const threadIds = (await convex.query(
    api.socialdata.getThreadIds
  )) as string[];

  // Handle thread not found
  if (!thread) {
    return <div>Thread not found</div>;
  }

  // Compute thread number
  const index = threadIds.indexOf(threadId);
  const threadNumber = index !== -1 ? threadIds.length - index : null;

  const tweets = thread.tweets;
  const user = tweets[0].user;

  return (
    <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 duration-300 md:mt-12">
      <Link
        href="/threads"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] ml-4 block w-fit duration-300 md:ml-28"
      >
        <h1 className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] text-3xl font-medium duration-300 md:text-5xl">
          <span className="inline-block rotate-180">➞</span> Thread #
          {threadNumber !== null ? threadNumber : ""}
        </h1>
      </Link>
      <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 grid grid-cols-1 gap-6 duration-300 md:mt-12 md:grid-cols-[calc(66.47%-1.5rem)_calc(33.53%-1.5rem)] md:px-28">
        <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 duration-300 @container md:px-0">
          {tweets.map((tweet, index) => (
            <TweetCard
              key={tweet.id_str}
              threadId={threadId}
              staticTweet={tweet}
              size="lg"
              showFullContent={true}
              showThread={index === tweets.length - 1}
            />
          ))}
        </section>

        <aside className="space-y-6">
          <Separator orientation="horizontal" className="block md:hidden" />
          <section
            aria-labelledby="hero-heading"
            className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 duration-300 md:px-0"
          >
            <Badge variant="outline">✶ Launching April 2025</Badge>
            <hgroup className="mt-4 max-w-2xl space-y-4">
              <h2 id="hero-heading" className="text-3xl font-medium">
                A search engine—to find customers.
              </h2>
              <p>Join the wait-list for early access and updates!</p>
            </hgroup>
            <WaitlistDrawer />
            <WaitlistUsers className="mt-6 md:mt-12" />
          </section>
          <Separator orientation="horizontal" />
          <section className="px-4 md:px-0">
            <h3 className="text-2xl font-medium">Author.</h3>
            <UserProfileCard
              className="mt-4"
              profileImageUrlHttps={user?.profile_image_url_https}
              name={user?.name}
              screenName={user?.screen_name}
              verified={user?.verified}
              description={user?.description}
              followersCount={user?.followers_count}
              friendsCount={user?.friends_count}
              url={user?.url}
            />
          </section>
          <Separator orientation="horizontal" />
          <section>
            <h3 className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 text-2xl font-medium duration-300 md:px-0">
              Recent threads.
            </h3>
            <RecentThreads bordered={true} threads={recentThreads} />
          </section>
        </aside>
      </div>

      <WaitlistSection />
    </div>
  );
}
