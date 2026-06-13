import Link from "next/link";
import {
  GITHUB_REPO_ISSUES_URL,
  GITHUB_REPO_URL,
} from "@/features/landing/lib/github";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/shared/ui/components/Card";
import { ArrowOutwardIcon } from "@/shared/ui/components/icons";

const DISCORD_SERVER_URL = "https://discord.gg/76dF9NPH";

const CARDS = [
  {
    title: "Read the code",
    description:
      "Every workflow, search strategy, and qualification rule is visible on GitHub.",
    linkLabel: "View source",
    href: GITHUB_REPO_URL,
  },
  {
    title: "Self-host it",
    description:
      "Run ReacherX on your own infrastructure. Same product. Your data stays with you.",
    linkLabel: "See the setup",
    href: GITHUB_REPO_URL,
  },
  {
    title: "Contribute",
    description:
      "Found a bug, want a feature, or disagree with how something works? Open a PR.",
    linkLabel: "Open an issue",
    href: GITHUB_REPO_ISSUES_URL,
  },
  {
    title: "Join the community",
    description:
      "Ask questions, swap playbooks, and help shape what ReacherX ships next.",
    linkLabel: "Join Discord",
    href: DISCORD_SERVER_URL,
  },
] as const;

function OpenSourceCardGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 104 109"
      className="pointer-events-none absolute right-0 bottom-0 h-24 w-24 text-foreground transition-transform duration-500 ease-out group-hover/card:scale-[0.82] sm:h-28 sm:w-28 lg:h-36 lg:w-36"
      fill="none"
    >
      <path
        d="M37.2252 34.23L69.4632 90.0678H4.98724L37.2252 34.23Z"
        className="fill-foreground/10 transition-colors duration-500 group-hover/card:fill-foreground/20 dark:fill-foreground/16 dark:group-hover/card:fill-foreground/28"
      />
      <path
        d="M62.8849 12.7964L97.8389 73.3385H27.9308L62.8849 12.7964Z"
        className="fill-foreground/6 transition-colors duration-500 group-hover/card:fill-foreground/14 dark:fill-foreground/10 dark:group-hover/card:fill-foreground/22"
      />
      <path
        d="M12.2142 33.8325L30.5924 2.00049L48.9707 33.8325H12.2142Z"
        className="stroke-foreground/30 transition-colors duration-500 group-hover/card:stroke-foreground/55 dark:stroke-foreground/35 dark:group-hover/card:stroke-foreground/70"
        strokeWidth="2"
      />
    </svg>
  );
}

export function OpenSourceSection() {
  return (
    <section
      aria-labelledby="open-source-heading"
      className="px-4 py-14 md:py-24"
    >
      <h2
        id="open-source-heading"
        className="font-pixel-square mb-10 text-center text-3xl leading-tight font-bold text-balance sm:text-4xl md:mb-16 md:text-5xl"
      >
        Other tools are closed-source. <br className="hidden md:block" />
        Agent is open-source.
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
        {CARDS.map(({ title, description, linkLabel, href }) => (
          <Link
            key={title}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            aria-label={`${title} — ${linkLabel}`}
            className="group/card focus-visible:ring-ring block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
          >
            <Card className="text-foreground bg-card relative flex h-full min-h-[260px] flex-col justify-between overflow-hidden rounded-xl border shadow-none sm:min-h-[300px] lg:min-h-[420px]">
              <OpenSourceCardGlyph />
              <CardHeader className="relative z-10 p-4 sm:p-5 lg:p-4">
                <CardTitle className="text-base text-inherit sm:text-lg">
                  {title}
                </CardTitle>
                <CardDescription className="text-foreground/80 max-w-[30ch] text-sm sm:text-base lg:text-sm">
                  {description}
                </CardDescription>
              </CardHeader>
              <CardFooter className="relative z-10 p-4 pt-0 sm:p-5 sm:pt-0 lg:p-4 lg:pt-0">
                <span className="bg-primary text-primary-foreground pointer-events-none inline-flex h-8 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap sm:h-9">
                  {linkLabel}
                  <ArrowOutwardIcon className="size-4 fill-current" />
                </span>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
