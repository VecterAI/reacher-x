import { InteractiveMockupFigure } from "../InteractiveMockupFigure";

export function RelationshipLayerSection() {
  return (
    <section
      aria-labelledby="relationship-layer-heading"
      className="px-4 py-16 md:py-24"
    >
      <h2
        id="relationship-layer-heading"
        className="font-pixel-square mb-16 text-center text-4xl font-bold md:mb-24 md:text-5xl"
      >
        Beyond outreach, Agent keeps things moving.
      </h2>

      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-5">
          <h3 className="text-2xl font-medium md:text-3xl">
            An early relationship layer inside Agent.
          </h3>
          <p className="mt-3 text-base">
            ReacherX already gives Agent a lightweight way to manage what
            happens after discovery begins. People move through stages through a
            mix of Agent activity and manual updates from you. Over time, Agent
            will go further by handling follow-ups, managing progress, and
            keeping relationships moving without forcing you into traditional
            CRM workflows. This is still early, and we will keep extending it as
            we learn what the right agent-first system should be.
          </p>
        </div>

        <div className="md:col-span-7">
          <InteractiveMockupFigure
            mockupAssetKey="landing-image-10"
            ariaLabel="Relationship layer preview"
            figureClassName="aspect-[4/3] w-full"
            className="h-full w-full"
          />
        </div>
      </div>
    </section>
  );
}
