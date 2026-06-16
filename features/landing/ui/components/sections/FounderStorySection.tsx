import Image from "next/image";

export function FounderStorySection() {
  return (
    <section
      aria-labelledby="founder-story-heading"
      className="px-4 py-16 md:py-24"
    >
      <h2
        id="founder-story-heading"
        className="font-pixel-square mb-12 text-center text-4xl font-bold md:mb-16 md:text-5xl"
      >
        Three years. <br className="hidden md:block" />A single goal.
      </h2>

      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12">
        <div className="bg-muted relative aspect-square w-full overflow-hidden">
          <Image
            src="/landing/founder-story/founder-2.webp"
            alt="Salman, Founder of ReacherX"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>

        {/* Essay — vertically centered */}
        <article className="flex flex-col justify-center space-y-4">
          <h3 className="text-2xl font-medium md:text-3xl">
            Three years. One goal.
          </h3>
          <p className="text-base leading-relaxed">
            I started ReacherX because finding the right people should not be
            this hard. Customers, candidates, investors, partners, creators,
            community members, or anyone else you need, they already exist
            somewhere on the internet. You should be able to say who you are
            looking for, and get the people who match.
          </p>
          <p className="text-base leading-relaxed">
            Three years in, it has been harder than I imagined. But I&apos;m
            still here, still building, still shipping.
          </p>
          <p className="text-base leading-relaxed">
            ReacherX is open source because I believe developers are the ones
            who change how software works. This space has been locked inside
            closed systems and messy workflows for too long. It should become an
            open ecosystem where people build, share, improve, and push the
            whole thing forward.
          </p>
          <footer className="pt-4">
            <p className="text-foreground font-medium">&mdash; Salman</p>
            <p className="text-foreground text-sm">Founder, 🆁 ReacherX</p>
          </footer>
        </article>
      </div>
    </section>
  );
}
