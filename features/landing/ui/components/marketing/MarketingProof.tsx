import { getPublicTestimonials } from "@/features/landing/lib/getPublicTestimonials";
import { marketingPageWidth } from "./MarketingLayout";
import { MarketingProofCarousel } from "./MarketingProofCarousel";

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
      <div className={marketingPageWidth}>
        <MarketingProofCarousel tweets={tweets} />
      </div>
    </section>
  );
}
