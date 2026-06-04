import { StepBlock } from "./StepBlock";

const STEPS = [
  {
    stepLabel: "Step #1",
    heading: "Describe who you need. Agent gets to work.",
    description:
      "Tell Agent who you need in plain English, or paste a URL. It builds ideal profiles for your use case and asks you to confirm before searching begins.",
    videoAssetKey: "how-step-1" as const,
    reversed: false,
  },
  {
    stepLabel: "Step #2",
    heading: "Agent searches X/Twitter and LinkedIn 24/7.",
    description:
      "It turns your ideal profiles into search strategies, reaches people based on what they actually post, scores each match from 0\u2013100, filters bots and spam, and keeps running in the background. New matches are surfaced every day.",
    videoAssetKey: "how-step-2" as const,
    reversed: true,
  },
  {
    stepLabel: "Step #3",
    heading: "Real context from real posts.",
    description:
      "Agent reads people\u2019s posts and extracts what matters: pain points, buying signals, and company details, each linked to the original post as proof. Not scraped data from a stale database. Live intelligence from what people are actually saying.",
    videoAssetKey: "how-step-3" as const,
    reversed: false,
  },
  {
    stepLabel: "Step #4",
    heading: "Agent plans. You approve.",
    description:
      "For each person, Agent creates a multi-step engagement or outreach plan. You review every draft and approve every action. Nothing is sent without you.",
    videoAssetKey: "how-step-4" as const,
    reversed: true,
  },
] as const;

export function HowAgentWorksSection() {
  return (
    <section
      aria-labelledby="how-agent-works-heading"
      className="px-4 py-16 md:py-24"
    >
      <h2
        id="how-agent-works-heading"
        className="font-pixel-square mb-16 text-center text-4xl font-bold md:mb-24 md:text-5xl"
      >
        How Agent works.
      </h2>
      <div className="space-y-16 md:space-y-24">
        {STEPS.map((step) => (
          <StepBlock key={step.stepLabel} {...step} />
        ))}
      </div>
    </section>
  );
}
