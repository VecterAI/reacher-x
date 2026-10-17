import { getPublicTestimonials } from "@/features/landing/lib/getPublicTestimonials";
import { marketingPageWidth } from "./MarketingLayout";
import { MarketingProofCarousel } from "./MarketingProofCarousel";
import { FilledHeartIcon } from "@/shared/ui/components/icons";

/**
 * Quotes come from the existing curated public feed. Development renders the
 * local fixtures as a preview; production only ever shows the real feed.
 */
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
          className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm"
        >
          Loved
          <FilledHeartIcon
            className="text-primary size-3.5 shrink-0"
            aria-hidden="true"
          />
          by our early community
        </h2>
      </div>
      <div className={marketingPageWidth}>
        <MarketingProofCarousel tweets={tweets} />
      </div>
    </section>
  );
}
