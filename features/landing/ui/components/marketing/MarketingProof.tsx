import { getPublicTestimonials } from "@/features/landing/lib/getPublicTestimonials";
import { cn } from "@/shared/lib/utils";
import { MarketingSection, marketingSectionTitle } from "./MarketingLayout";
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
    <MarketingSection labelledBy="marketing-proof-title">
      <h2
        id="marketing-proof-title"
        className={cn(
          marketingSectionTitle,
          "mx-auto text-center lg:max-w-none"
        )}
      >
        Loved{" "}
        <FilledHeartIcon
          className="text-primary inline size-[0.72em] shrink-0 align-[-0.06em]"
          aria-hidden="true"
        />{" "}
        by our early community.
      </h2>
      <div className="mt-14">
        <MarketingProofCarousel tweets={tweets} />
      </div>
    </MarketingSection>
  );
}
