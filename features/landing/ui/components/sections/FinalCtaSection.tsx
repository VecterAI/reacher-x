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
        Let your{" "}
        <span className="inline-flex items-center gap-[0.18em] align-baseline">
          <code className="text-foreground relative top-[0.03em] inline-flex size-[1.22em] shrink-0 items-center justify-center rounded-[0.18em] border align-middle font-mono text-[0.84em] font-medium leading-none tracking-normal">
            △
          </code>
          <span>Agent</span>
        </span>{" "}
        reach them.
      </h2>
      <div className="mt-8">
        <LandingPrimaryCta className="mx-auto" />
      </div>
    </section>
  );
}
