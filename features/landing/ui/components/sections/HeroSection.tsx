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
          className="font-pixel-square text-4xl leading-[1.04] font-bold tracking-tight md:leading-[1.14] md:text-6xl"
        >
          Open-source, self-improving{" "}
          <span className="inline-flex items-center gap-[0.18em] align-baseline">
            <code className="text-foreground relative top-[0.03em] inline-flex size-[1.22em] shrink-0 items-center justify-center rounded-[0.18em] border align-middle font-mono text-[0.84em] font-medium leading-none tracking-normal">
              △
            </code>
            <span>Agent</span>
          </span>{" "}
          that reaches the people you need in real time.
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
