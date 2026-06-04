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
        {/* Founder photo — replace div with next/image once /public/founder.jpg exists */}
        <div
          className="bg-muted aspect-square w-full"
          role="img"
          aria-label="Salman, Founder of ReacherX"
        />

        {/* Essay — vertically centered */}
        <article className="flex flex-col justify-center space-y-4">
          <h3 className="text-2xl font-medium md:text-3xl">
            Three years. One goal.
          </h3>
          <p className="text-base leading-relaxed">
            I started ReacherX because ads felt broken. The people you need
            already exist, posting their problems, asking for help, and looking
            for what you&apos;re building. They are not missing. They are just
            hard to reach.
          </p>
          <p className="text-base leading-relaxed">
            Three years in, it has been harder than I imagined. But I&apos;m
            still here, still building, still shipping.
          </p>
          <p className="text-base leading-relaxed">
            ReacherX is open source because I believe in Open Source as a
            philosophy; the best tools are built in the open. If it helps you
            reach the people you need, the effort is worth it.
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
