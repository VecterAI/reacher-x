// app/(landing)/threads/[threadId]/page.tsx
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { ThreadCard } from "@/features/threads/ui/components/ThreadCard";
import { UserProfileCard } from "@/features/landing/ui/components/UserProfileCard";
import { Separator } from "@/shared/ui/components/Separator";

import { Badge } from "@/shared/ui/components/Badge";
import { RecentThreads } from "@/features/threads/ui/components/RecentThreads";
import { Thread } from "../../../../features/threads/types";
import Link from "next/link";

import { getRecentThreads } from "@/features/threads/lib/getRecentThreads";

import { buttonVariants } from "@/shared/ui/components/Button";
import { FigureVideo } from "@/features/landing/ui/components/FigureVideo";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params; // Await the params Promise
  const thread = (await convex.query(api.socialdataMutations.getThreadById, {
    threadId,
  })) as Thread | null;

  if (!thread) {
    return {
      title: "Thread Not Found",
      description: "This thread could not be found.",
    };
  }

  const firstTweet = thread.tweets[0];
  const ogImage =
    firstTweet?.entities?.media?.[0]?.media_url_https || "/og-default.jpg";
  const title = `Thread by @${firstTweet?.user?.screen_name || "unknown"}`;
  const description = firstTweet?.full_text?.slice(0, 160);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImage],
      url: `https://reacherx.com/threads/${threadId}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ThreadDetailPage(props: {
  params: Promise<{ threadId: string }>;
}) {
  const params = await props.params;
  const { threadId } = params;
  const recentThreads = await getRecentThreads(4);
  const filteredRecentThreads = recentThreads
    .filter((thread) => thread.threadId !== threadId)
    .slice(0, 3);

  // Fetch thread data and thread IDs on the server
  const thread = (await convex.query(api.socialdataMutations.getThreadById, {
    threadId,
  })) as Thread | null;
  const threadIds = (await convex.query(
    api.socialdataMutations.getThreadIds
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
    <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mx-auto mt-4 w-full max-w-[1288px] duration-300 md:mt-12">
      <Link
        href="/home/threads"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] ml-4 block w-fit duration-300 md:ml-0"
      >
        <h1 className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] text-2xl font-medium duration-300 md:text-3xl">
          <span className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] inline-block rotate-180 transform-gpu text-muted-foreground duration-300 hover:translate-x-1">
            ➞
          </span>{" "}
          Thread{" "}
          <span className="font-mono font-normal text-muted-foreground">
            #{threadNumber !== null ? threadNumber : ""}
          </span>
        </h1>
      </Link>
      <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] grid grid-cols-1 gap-6 duration-300 md:mt-12 md:grid-cols-[calc(66.47%-1.5rem)_calc(33.53%-1.5rem)] md:gap-12">
        <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 duration-300 @container md:px-0">
          {tweets.map((tweet, index) => (
            <ThreadCard
              className="pt-2"
              key={tweet.id_str}
              staticTweet={tweet}
              size="lg"
              showFullContent={true}
              showThread={index === tweets.length - 1}
            />
          ))}
        </section>
        <Separator orientation="horizontal" className="block md:hidden" />
        <aside className="space-y-6">
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
          <section
            id="hero"
            aria-labelledby="hero-heading"
            className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] grid grid-cols-1 gap-y-4 px-4 duration-300 md:px-0"
          >
            <div>
              <Badge variant="outline">v3.0 beta</Badge>
              <hgroup className="mt-4 space-y-2">
                <h2 id="hero-heading" className="text-3xl font-medium">
                  The search engine—to find customers on X/Twitter.
                </h2>
                <p className="text-base font-medium text-muted-foreground">
                  ReacherX finds people who need your{" "}
                  <span className="text-foreground">next big thing</span> right
                  now. This is{" "}
                  <span className="text-foreground">faster and cheaper</span>{" "}
                  than ads to reach your audience.
                </p>
              </hgroup>
              <Link
                href="/onboarding"
                className={`${buttonVariants({ variant: "default" })} mt-4`}
              >
                Start finding customers
              </Link>
              <br />
              <small className="mt-2 block text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  One year free
                </span>{" "}
                for first{" "}
                <span className="font-mono font-medium text-foreground">
                  100
                </span>{" "}
                users.
              </small>
            </div>
            <FigureVideo
              mp4Url="https://8xibu2ksfzfcma9o.public.blob.vercel-storage.com/landing/videos/mp4/product-demo/app-demo/reacher-x-v3-app-demo-1-oOUz7R06yhbxY4mtKIwv8NkjK73DkT.mp4"
              ariaLabel="ReacherX video"
              figureClassName="order-last col-span-12 aspect-[1/1] md:order-none portrait:md:col-span-12 landscape:md:col-span-5"
              className="aspect-[1/1] h-full w-full rounded-none"
            />
          </section>

          <Separator orientation="horizontal" />
          <section>
            <h3 className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 text-2xl font-medium duration-300 md:px-0">
              Recent threads.
            </h3>
            <RecentThreads bordered={true} threads={filteredRecentThreads} />
          </section>
        </aside>
      </div>
    </div>
  );
}
