import Link from "next/link";
import { StepBlock } from "./StepBlock";

const FEATURES = [
  {
    heading: "Agent writes like you. Not like a bot.",
    description: (
      <>
        It learns your voice from your connected X/Twitter and LinkedIn
        accounts, plus the edits you make to its drafts. It learns your
        vocabulary, humor, sentence structure, tone, and directness.
        <br />
        <br />
        Your voice is elevated. Not replaced.
        <br />
        <br />
        Agent is built for thoughtful, human-paced outreach, not spam. Connecting
        your accounts is not what creates risk; blasting generic messages or
        pushing unnatural volume does.{" "}
        <Link
          href="#faqs-heading"
          className="font-medium underline underline-offset-4"
        >
          See how account safety works
        </Link>
        .
      </>
    ),
    mockupAssetKey: "landing-image-5" as const,
    reversed: false,
  },
  {
    heading: "Agent has full context on every enriched person.",
    description:
      "Before drafting a reply or DM, Agent reads their recent posts, reviews their enriched profile, and checks your full interaction history with them. It doesn\u2019t send generic templates. Every message is tailored and personalised to get the highest response rate.",
    mockupAssetKey: "landing-image-6" as const,
    reversed: true,
  },
  {
    heading: "Agent improves from your feedback.",
    description:
      "Every edit, approval, rejection, and skip teaches Agent. It gets better at reaching, qualifying, and writing for the people you care about.",
    mockupAssetKey: "landing-image-7" as const,
    reversed: false,
  },
] as const;

export function GetsSmarterSection() {
  return (
    <section
      aria-labelledby="gets-smarter-heading"
      className="px-4 py-16 md:py-24"
    >
      <h2
        id="gets-smarter-heading"
        className="font-pixel-square mb-16 text-center text-4xl font-bold md:mb-24 md:text-5xl"
      >
        Agent gets smarter over time. <br className="hidden md:block" />
        Not a tool. An agent that learns.
      </h2>
      <div className="space-y-16 md:space-y-24">
        {FEATURES.map((feature) => (
          <StepBlock key={feature.heading} {...feature} />
        ))}
      </div>
    </section>
  );
}
