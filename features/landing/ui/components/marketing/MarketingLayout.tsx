import { cn } from "@/shared/lib/utils";
import type { ReactNode } from "react";
import { buttonVariants } from "@/shared/ui/components/Button";
import {
  ApolloIcon,
  ChangeHistoryIcon,
  ClayIcon,
  FilledLinkedinIcon,
  FilledTwitterIcon,
} from "@/shared/ui/components/icons";

/**
 * Split `text` on `terms` (which appear in order) and render each match in the
 * primary color. Terms that do not occur are skipped.
 */
export function highlightTerms(
  text: string,
  terms: readonly string[]
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let key = 0;
  for (const term of terms) {
    const index = rest.indexOf(term);
    if (index === -1) continue;
    if (index > 0) nodes.push(rest.slice(0, index));
    nodes.push(
      <span key={key++} className="text-primary">
        {term}
      </span>
    );
    rest = rest.slice(index + term.length);
  }
  nodes.push(rest);
  return nodes;
}

export type InlineIconTerm = {
  term: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  /** Text shown after the icon; defaults to `term`. Use when the copy's
   * glyph (e.g. "△ Agent") is replaced by the icon itself. */
  display?: string;
  /** Badge chip tint classes; omitted when the logo is full-bleed colored. */
  bg?: string;
  fg?: string;
};

export type InlineIconSegment =
  | { kind: "text"; text: string }
  | {
      kind: "icon";
      term: string;
      display: string;
      Icon: InlineIconTerm["Icon"];
      bg?: string;
      fg?: string;
    };

// Badge tiles mirror ProspectPlatformAvatar's platform badge styling. Brand
// logos (Clay, Apollo) ship full-bleed artwork and render without a chip.
const PLATFORM_TERMS: InlineIconTerm[] = [
  {
    term: "X/Twitter",
    Icon: FilledTwitterIcon,
    bg: "bg-platform-twitter-badge",
    fg: "text-platform-twitter-badge-foreground",
  },
  {
    term: "LinkedIn",
    Icon: FilledLinkedinIcon,
    bg: "bg-platform-linkedin-badge",
    fg: "text-platform-linkedin-badge-foreground",
  },
  { term: "Clay", Icon: ClayIcon },
  { term: "Apollo", Icon: ApolloIcon },
];

/** "△ Agent" copy renders as the app's agent glyph + "Agent". */
export const AGENT_TERMS: InlineIconTerm[] = [
  { term: "△ Agent", Icon: ChangeHistoryIcon, display: "Agent" },
];

/**
 * Split `text` into plain and icon segments by earliest term match, in
 * reading order. Shared by inlinePlatformIcons and the scroll-fill
 * narrative, which decorates text differently.
 */
export function getInlineIconSegments(
  text: string,
  terms: readonly InlineIconTerm[] = PLATFORM_TERMS
): InlineIconSegment[] {
  const segments: InlineIconSegment[] = [];
  let rest = text;
  for (;;) {
    let match: (InlineIconTerm & { index: number }) | null = null;
    for (const candidate of terms) {
      const index = rest.indexOf(candidate.term);
      if (index === -1) continue;
      if (!match || index < match.index) match = { ...candidate, index };
    }
    if (!match) break;
    if (match.index > 0) {
      segments.push({ kind: "text", text: rest.slice(0, match.index) });
    }
    segments.push({
      kind: "icon",
      term: match.term,
      display: match.display ?? match.term,
      Icon: match.Icon,
      bg: match.bg,
      fg: match.fg,
    });
    rest = rest.slice(match.index + match.term.length);
  }
  if (rest) segments.push({ kind: "text", text: rest });
  return segments;
}

/**
 * Render `text` with each platform term prefixed by its inline brand icon.
 * Companion to highlightTerms for icon emphasis; unmatched terms are skipped.
 */
export function inlinePlatformIcons(
  text: string,
  terms: readonly InlineIconTerm[] = PLATFORM_TERMS
): ReactNode {
  return getInlineIconSegments(text, terms).map((segment, index) => {
    if (segment.kind === "text") return segment.text;
    return (
      <span key={index} className="whitespace-nowrap">
        {segment.bg && segment.fg ? (
          <span
            className={cn(
              "mr-1 inline-flex size-4 items-center justify-center rounded-[4px] align-[-2px]",
              segment.bg,
              segment.fg
            )}
          >
            <segment.Icon className="size-3.5 shrink-0" aria-hidden="true" />
          </span>
        ) : (
          <segment.Icon
            className="mr-1 inline size-4 align-[-2px]"
            aria-hidden="true"
          />
        )}
        {segment.display}
      </span>
    );
  });
}

export function marketingButton(
  options: Parameters<typeof buttonVariants>[0] = {}
) {
  return cn(
    buttonVariants(options),
    options?.size !== "xs" && options?.size !== "xsIcon" && "rounded-full"
  );
}

/**
 * Single source of truth for marketing layout tokens.
 * Every section consumes these; never introduce ad-hoc padding or type scales.
 */
export const marketingPageWidth = "mx-auto w-full max-w-[1440px] px-4 lg:px-10";
export const marketingSection = "py-20 lg:py-28";
export const marketingSectionTitle =
  "max-w-3xl text-4xl leading-[1.1] font-normal tracking-[-0.03em] text-balance sm:text-5xl lg:text-6xl";
export const marketingTextColumn = "max-w-md";

export function MarketingSection({
  id,
  className,
  children,
  labelledBy,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        marketingPageWidth,
        marketingSection,
        "scroll-mt-24",
        className
      )}
    >
      {children}
    </section>
  );
}

export function MarketingHero({
  title,
  children,
  actions,
  eyebrow,
  lede,
  below,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  lede?: ReactNode;
  below?: ReactNode;
  className?: string;
}) {
  const hasSideColumn = Boolean(children);
  return (
    <section
      id="get-started"
      className={cn(
        marketingPageWidth,
        "flex scroll-mt-24 flex-col justify-center py-20 lg:py-28",
        className
      )}
    >
      {eyebrow && (
        <div className="text-foreground mb-12 text-sm font-medium">
          {eyebrow}
        </div>
      )}
      <div
        className={cn(
          "grid items-center",
          hasSideColumn ? "gap-14 lg:grid-cols-2 lg:gap-32" : "gap-0"
        )}
      >
        <div className={cn(!hasSideColumn && "text-center")}>
          <h1 className="text-4xl leading-[1.05] font-normal tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {title}
          </h1>
          {lede && (
            <div
              className={cn(
                "text-foreground mt-8 text-lg leading-7 font-medium text-pretty",
                hasSideColumn ? "max-w-md" : "mx-auto max-w-2xl"
              )}
            >
              {lede}
            </div>
          )}
          {actions && (
            <div
              className={cn(
                "mt-10 flex flex-wrap items-center gap-3",
                !hasSideColumn && "justify-center"
              )}
            >
              {actions}
            </div>
          )}
        </div>
        {children ? (
          <div
            className={cn(marketingTextColumn, "w-full lg:justify-self-end")}
          >
            {children}
          </div>
        ) : null}
      </div>
      {below ? (
        /*
         * Matches the demo column of the two-column feature sections:
         * 3fr of (1fr + 3fr) split with a 56px gutter, centered.
         */
        <div className="mt-14 flex justify-center">
          <div className="w-full min-w-0 lg:w-[calc((100%-56px)*3/4)]">
            {below}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The shared two-column feature layout: big title, demo on one side, copy on
 * the other. MarketingFeature wraps it in a section; tabbed panels reuse the
 * same columns so every two-column block on the page reads identically.
 */
export function MarketingFeatureColumns({
  title,
  children,
  demo,
  reverse = false,
  titleAs: Title = "h2",
}: {
  title: ReactNode;
  children: ReactNode;
  demo: ReactNode;
  reverse?: boolean;
  titleAs?: "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "grid gap-8 lg:gap-x-14 lg:gap-y-10",
        reverse
          ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]"
          : "lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]"
      )}
    >
      <Title className={cn(marketingSectionTitle, reverse && "lg:col-start-2")}>
        {title}
      </Title>
      <div
        className={cn(
          "min-w-0",
          reverse
            ? "lg:col-start-2 lg:row-start-2"
            : "lg:col-start-1 lg:row-start-2"
        )}
      >
        {demo}
      </div>
      <div
        className={cn(
          marketingTextColumn,
          "self-center lg:max-w-xs",
          reverse
            ? "lg:col-start-1 lg:row-start-2"
            : "lg:col-start-2 lg:row-start-2"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function MarketingFeature({
  title,
  children,
  demo,
  reverse = false,
  id,
}: {
  title: ReactNode;
  children: ReactNode;
  demo: ReactNode;
  reverse?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(marketingPageWidth, marketingSection, "scroll-mt-24")}
    >
      <MarketingFeatureColumns title={title} demo={demo} reverse={reverse}>
        {children}
      </MarketingFeatureColumns>
    </section>
  );
}
