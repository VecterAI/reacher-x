import { LandingPrimaryCta } from "../LandingPrimaryCta";
import { ThemedFigureVideo } from "../ThemedFigureVideo";

export function HeroSection() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="px-4 pt-8 pb-16 md:pt-16 md:pb-24"
    >
      {/* Text */}
      <div className="mx-auto max-w-3xl text-center">
        <h1
          id="hero-heading"
          className="font-pixel-square text-4xl font-bold tracking-tight md:text-6xl"
        >
          Open-source, self-improving Agent that reaches the people you need in
          real time.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base md:text-lg">
          Customers, candidates, investors, partners, creators, community
          members, whoever you need.
        </p>

        {/* CTA */}
        <div className="mt-6">
          <LandingPrimaryCta className="mx-auto" skeletonClassName="mx-auto" />
        </div>
      </div>

      {/* Demo video — no frame, just the video */}
      <div className="mt-12 md:mt-16">
        <ThemedFigureVideo
          videoAssetKey="hero"
          ariaLabel="ReacherX Agent dashboard demo"
          figureClassName="aspect-[4/3] w-full"
          className="h-full w-full"
          initialPreload="metadata"
          variant="player"
        />
      </div>
    </section>
  );
}
