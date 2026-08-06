import { LandingBookDemoCta } from "../LandingBookDemoCta";
import { LandingPrimaryCta } from "../LandingPrimaryCta";
import { LandingAgentMark } from "../LandingAgentMark";
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
          className="font-pixel-square text-4xl leading-[1.04] font-bold tracking-tight md:text-6xl md:leading-[1.14]"
        >
          Open-source, self-improving{" "}
          <span className="inline-flex items-center gap-[0.18em] align-baseline">
            <LandingAgentMark />
            <span>Agent</span>
          </span>{" "}
          that reaches the people you need in real time.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base md:text-lg">
          Customers, candidates, investors, partners, creators, community
          members, whoever you need.
        </p>

        {/* CTA */}
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LandingPrimaryCta />
          <LandingBookDemoCta />
        </div>
      </div>

      {/* Demo video — match Mux asset aspect ratio (335:216) to avoid letterboxing */}
      <div className="mt-12 md:mt-16">
        <ThemedFigureVideo
          videoAssetKey="hero"
          ariaLabel="ReacherX Agent dashboard demo"
          figureClassName="aspect-[335/216] w-full"
          className="h-full w-full"
          initialPreload="metadata"
          variant="player"
        />
      </div>
    </section>
  );
}
