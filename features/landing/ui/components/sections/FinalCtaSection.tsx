import { LandingAgentMark } from "../LandingAgentMark";
import { LandingBookDemoCta } from "../LandingBookDemoCta";
import { LandingPrimaryCta } from "../LandingPrimaryCta";

export function FinalCtaSection() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="px-4 py-24 text-center md:py-32"
    >
      <h2
        id="final-cta-heading"
        className="font-pixel-square text-4xl font-medium md:text-5xl"
      >
        The people you need are already out there.{" "}
        <br className="hidden md:block" />
        Let your{" "}
        <span className="inline-flex items-center gap-[0.18em] align-baseline">
          <LandingAgentMark />
          <span>Agent</span>
        </span>{" "}
        reach them.
      </h2>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <LandingPrimaryCta />
        <LandingBookDemoCta />
      </div>
    </section>
  );
}
