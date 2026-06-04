import Link from "next/link";
import {
  GITHUB_REPO_ISSUES_URL,
  GITHUB_REPO_URL,
} from "@/features/landing/lib/github";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/components/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/shared/ui/components/Card";
import { ArrowOutwardIcon } from "@/shared/ui/components/icons";

const DISCORD_SERVER_URL = "https://discord.gg/76dF9NPH";

interface OrbitPatternConfig {
  core: { cx: number; cy: number; r: number };
  dashed: { cx: number; cy: number; r: number };
  outer: { cx: number; cy: number; r: number };
  satellite?: { cx: number; cy: number; r: number };
  diagonals: ReadonlyArray<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>;
  sweeps: ReadonlyArray<string>;
}

const CARDS = [
  {
    title: "Read the code",
    description:
      "Every workflow, search strategy, and qualification rule is visible on GitHub.",
    linkLabel: "View source",
    href: GITHUB_REPO_URL,
    pattern: {
      core: { cx: 258, cy: 332, r: 34 },
      dashed: { cx: 258, cy: 332, r: 78 },
      outer: { cx: 258, cy: 332, r: 112 },
      satellite: { cx: 228, cy: 164, r: 20 },
      diagonals: [
        { x1: 18, y1: 460, x2: 182, y2: 286 },
        { x1: 64, y1: 474, x2: 214, y2: 316 },
      ],
      sweeps: [
        "M182 126C224 103 272 101 326 121",
        "M166 151C221 119 278 115 344 139",
        "M149 178C218 137 285 132 364 160",
      ],
    },
  },
  {
    title: "Self-host it",
    description:
      "Run ReacherX on your own infrastructure. Same product. Your data stays with you.",
    linkLabel: "See the setup",
    href: GITHUB_REPO_URL,
    pattern: {
      core: { cx: 244, cy: 316, r: 36 },
      dashed: { cx: 244, cy: 316, r: 86 },
      outer: { cx: 244, cy: 316, r: 122 },
      satellite: { cx: 292, cy: 206, r: 18 },
      diagonals: [
        { x1: 22, y1: 438, x2: 188, y2: 264 },
        { x1: 72, y1: 474, x2: 224, y2: 314 },
      ],
      sweeps: [
        "M176 140C222 114 273 110 332 130",
        "M158 166C217 131 278 126 348 150",
        "M140 194C212 151 284 145 366 174",
      ],
    },
  },
  {
    title: "Contribute",
    description:
      "Found a bug, want a feature, or disagree with how something works? Open a PR.",
    linkLabel: "Open an issue",
    href: GITHUB_REPO_ISSUES_URL,
    pattern: {
      core: { cx: 110, cy: 344, r: 30 },
      dashed: { cx: 110, cy: 344, r: 72 },
      outer: { cx: 110, cy: 344, r: 104 },
      satellite: { cx: 250, cy: 214, r: 24 },
      diagonals: [
        { x1: 134, y1: 474, x2: 284, y2: 302 },
        { x1: 176, y1: 474, x2: 318, y2: 316 },
      ],
      sweeps: [
        "M132 170C168 149 208 147 252 164",
        "M152 196C196 170 243 167 295 186",
        "M170 222C221 191 277 188 335 210",
      ],
    },
  },
  {
    title: "Join the community",
    description:
      "Ask questions, swap playbooks, and help shape what ReacherX ships next.",
    linkLabel: "Join Discord",
    href: DISCORD_SERVER_URL,
    pattern: {
      core: { cx: 274, cy: 326, r: 32 },
      dashed: { cx: 274, cy: 326, r: 80 },
      outer: { cx: 274, cy: 326, r: 118 },
      satellite: { cx: 86, cy: 212, r: 20 },
      diagonals: [
        { x1: 8, y1: 408, x2: 176, y2: 260 },
        { x1: 48, y1: 454, x2: 210, y2: 310 },
      ],
      sweeps: [
        "M178 136C222 111 271 107 326 128",
        "M162 162C218 129 276 124 342 148",
        "M146 189C214 149 284 143 360 170",
      ],
    },
  },
] as const;

function OpenSourceCardPattern({ pattern }: { pattern: OrbitPatternConfig }) {
  const commonClassName =
    "pointer-events-none absolute inset-0 h-full w-full text-foreground/14";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 474"
      className={commonClassName}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {pattern.sweeps.map((sweep) => (
        <path key={sweep} d={sweep} stroke="currentColor" strokeWidth="1" />
      ))}
      {pattern.diagonals.map((diagonal) => (
        <path
          key={`${diagonal.x1}-${diagonal.y1}-${diagonal.x2}-${diagonal.y2}`}
          d={`M${diagonal.x1} ${diagonal.y1}L${diagonal.x2} ${diagonal.y2}`}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
      <circle
        cx={pattern.outer.cx}
        cy={pattern.outer.cy}
        r={pattern.outer.r}
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle
        cx={pattern.dashed.cx}
        cy={pattern.dashed.cy}
        r={pattern.dashed.r}
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="5 9"
      />
      <circle
        cx={pattern.core.cx}
        cy={pattern.core.cy}
        r={pattern.core.r}
        stroke="currentColor"
        strokeWidth="1"
      />
      {pattern.satellite ? (
        <circle
          cx={pattern.satellite.cx}
          cy={pattern.satellite.cy}
          r={pattern.satellite.r}
          stroke="currentColor"
          strokeWidth="1"
        />
      ) : null}
      <path
        d={`M${pattern.core.cx - pattern.outer.r - 26} ${pattern.core.cy + 124}C${pattern.core.cx - 34} ${pattern.core.cy + 96} ${pattern.core.cx + 28} ${pattern.core.cy + 96} ${pattern.core.cx + pattern.outer.r + 18} ${pattern.core.cy + 120}`}
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

export function OpenSourceSection() {
  return (
    <section
      aria-labelledby="open-source-heading"
      className="px-4 py-16 md:py-24"
    >
      <h2
        id="open-source-heading"
        className="font-pixel-square mb-12 text-center text-4xl font-bold md:mb-16 md:text-5xl"
      >
        Ads are closed source. <br className="hidden md:block" />
        Agent is open source.
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CARDS.map(({ title, description, linkLabel, href, pattern }) => (
          <Link
            key={title}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            aria-label={`${title} — ${linkLabel}`}
            className="focus-visible:ring-ring block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
          >
            <Card className="text-foreground relative flex h-full min-h-[474px] flex-col justify-between overflow-hidden rounded-xl border bg-transparent shadow-none">
              <OpenSourceCardPattern pattern={pattern} />
              <CardHeader className="relative z-10 p-4">
                <CardTitle className="text-lg text-inherit">{title}</CardTitle>
                <CardDescription className="text-foreground max-w-[30ch]">
                  {description}
                </CardDescription>
              </CardHeader>
              <CardFooter className="relative z-10 p-4 pt-0">
                <span
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "pointer-events-none rounded-full"
                  )}
                >
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
