import { LandingPrimaryCta } from "../LandingPrimaryCta";

export function FinalCtaSection() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="px-4 py-24 text-center md:py-32"
    >
      <h2
        id="final-cta-heading"
        className="font-pixel-square text-4xl font-bold md:text-5xl"
      >
        The people you need are already out there.{" "}
        <br className="hidden md:block" />
        Let your Agent reach them.
      </h2>
      <div className="mt-8">
        <LandingPrimaryCta className="mx-auto" skeletonClassName="mx-auto" />
      </div>
    </section>
  );
}
