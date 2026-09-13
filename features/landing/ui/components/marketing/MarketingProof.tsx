import { ThreadCard } from "@/features/threads/ui/components/ThreadCard";
import { MarketingMarquee } from "./MarketingMarquee";
import { getPublicTestimonials } from "@/features/landing/lib/getPublicTestimonials";
import { marketingPageWidth } from "./MarketingLayout";
import "./marketing-proof.css";

/** Quotes come from the existing curated public feed. Never publish demo fixtures. */
export async function MarketingProof() {
  const tweets = (await getPublicTestimonials(8)).filter(
    (tweet) =>
      /^\d+$/.test(tweet.id_str ?? "") &&
      tweet.user?.screen_name &&
      tweet.full_text
  );
  if (!tweets.length) return null;
  return (
    <section aria-labelledby="marketing-proof-title" className="py-12 lg:py-20">
      <div
        className={`${marketingPageWidth} mb-10 flex items-end justify-between gap-5`}
      >
        <h2
          id="marketing-proof-title"
          className="text-3xl font-normal tracking-tight sm:text-4xl"
        >
          Early users, in their own words.
        </h2>
      </div>
      <MarketingMarquee count={tweets.length}>
        <div className="marketing-proof-track">
          {(tweets.length > 1 ? [0, 1] : [0]).map((copy) => (
            <div
              key={copy}
              className="marketing-proof-group"
              aria-hidden={copy === 1 ? true : undefined}
              inert={copy === 1 ? true : undefined}
            >
              {tweets.map((tweet) => (
                <div key={tweet.id_str} className="marketing-proof-post">
                  <ThreadCard
                    staticTweet={tweet}
                    size="sm"
                    characterLimit={280}
                    className="[&_[data-orientation=vertical]]:hidden"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </MarketingMarquee>
    </section>
  );
}
