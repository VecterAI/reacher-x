import { MarketingMarquee } from "./MarketingMarquee";
import { TestimonialCard } from "./TestimonialCard";
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
    <section aria-labelledby="marketing-proof-title" className="py-10 lg:py-14">
      <div className={`${marketingPageWidth} mb-8`}>
        <h2
          id="marketing-proof-title"
          className="text-muted-foreground text-sm"
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
                  <TestimonialCard tweet={tweet} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </MarketingMarquee>
    </section>
  );
}
