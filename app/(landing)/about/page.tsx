import type { Metadata } from "next";
import Link from "next/link";
import {
  marketingContainer,
  MarketingTrust,
} from "@/features/landing/ui/components/marketing/MarketingSections";

export const metadata: Metadata = {
  title: "About ReacherX",
  description:
    "Why Salman is building ReacherX for solo founders and small teams who need to find the right people.",
  alternates: { canonical: "https://reacherx.com/about" },
};
export default function AboutPage() {
  return (
    <>
      <article className={`${marketingContainer} py-16 sm:py-24`}>
        <p className="text-muted-foreground mb-6 font-mono text-xs">
          A NOTE FROM SALMAN
        </p>
        <h1 className="max-w-4xl text-5xl font-medium text-balance sm:text-7xl">
          I could build the product.
          <br />
          Finding people was harder.
        </h1>
        <div className="text-muted-foreground mt-12 max-w-2xl space-y-6 text-lg leading-8">
          <p>
            I'm a developer and designer. I built ReacherX because I wanted help
            finding the right people without having to learn a whole sales
            system first.
          </p>
          <p>
            A small team needs customers, teammates, partners, and sometimes
            investors. Each search is different. The work behind it is familiar:
            find someone relevant, understand what they care about, and figure
            out whether you have a reason to talk.
          </p>
          <p>
            I want AI to help with that work. I also want the person using it to
            care about the person receiving the message. More messages alone
            aren't the goal.
          </p>
          <p>
            ReacherX is self-funded, open source, and still in beta. I'm
            building it for people working on their own or with a small team.
            Your feedback helps me decide what to fix next.
          </p>
          <p>
            <a
              href="mailto:creativecoder.crco@gmail.com"
              className="text-foreground underline underline-offset-4"
            >
              Write to me
            </a>
          </p>
        </div>
        <div className="mt-12 flex flex-wrap gap-6 text-sm">
          <Link
            href="/blog/what-reacherx-is-for"
            className="underline underline-offset-4"
          >
            Who ReacherX is for
          </Link>
          <Link
            href="/blog/ai-and-human-connection"
            className="underline underline-offset-4"
          >
            AI and human connection
          </Link>
          <Link
            href="/blog/help-build-reacherx"
            className="underline underline-offset-4"
          >
            Help build ReacherX
          </Link>
        </div>
      </article>
      <MarketingTrust />
    </>
  );
}
