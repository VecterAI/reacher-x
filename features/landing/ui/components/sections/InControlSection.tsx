import { StepBlock } from "./StepBlock";

export function InControlSection() {
  return (
    <section
      aria-labelledby="in-control-heading"
      className="px-4 py-16 md:py-24"
    >
      <h2
        id="in-control-heading"
        className="font-pixel-square mb-16 text-center text-4xl font-medium md:mb-24 md:text-5xl"
      >
        You&apos;re always in control.
      </h2>
      <div className="space-y-16 md:space-y-24">
        <StepBlock
          heading="Do it yourself. Or delegate to Agent."
          description="You can manually reply to people, send DMs, and engage with their posts all from inside ReacherX. Or ask Agent to generate an outreach plan, or give it a command and have it execute it on your behalf. Either way, nothing sends without your approval."
          mockupAssetKey="landing-image-8"
          reversed={false}
        />
        <StepBlock
          heading="Separate workspaces for separate goals."
          description="Each workspace has its own ideal profiles, pipeline stages, discovered people, outreach history, and agent memory. Run customer prospecting in one workspace, recruiting in another, and investor discovery in a third."
          mockupAssetKey="landing-image-9"
          reversed={true}
        />
      </div>
    </section>
  );
}
