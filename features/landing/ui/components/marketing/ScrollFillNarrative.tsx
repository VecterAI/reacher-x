"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";
import {
  FilledLinkedinIcon,
  FilledTwitterIcon,
  ForumIcon,
  ImageIcon,
  MicIcon,
  PersonIcon,
  ThumbUpIcon,
  VideoLibraryIcon,
} from "@/shared/ui/components/icons";
import { getInlineIconSegments, type InlineIconTerm } from "./MarketingLayout";
import "./marketing-scroll-fill.css";

/**
 * Icon-decorated terms for the narrative, using the app's own icon set so
 * the copy feels like the product. Every icon renders bare at glyph size,
 * currentColor, dimming and filling with its text. Sizing is em-based so
 * icons scale with the paragraph's responsive font size.
 */
const NARRATIVE_TERMS: InlineIconTerm[] = [
  { term: "X/Twitter", Icon: FilledTwitterIcon },
  { term: "LinkedIn", Icon: FilledLinkedinIcon },
  { term: "voice notes", Icon: MicIcon },
  { term: "images", Icon: ImageIcon },
  { term: "videos", Icon: VideoLibraryIcon },
  { term: "View profiles", Icon: PersonIcon },
  { term: "like", Icon: ThumbUpIcon },
  { term: "comment", Icon: ForumIcon },
];

/** Characters ahead of the frontier that wear the accent color. */
const FILL_EDGE_UNITS = 5;

/** Viewport band a paragraph travels through while it fills. */
const START_LINE_RATIO = 0.85;
/** Scroll distance over which the whole narrative fills. */
const FILL_RUNWAY_RATIO = 1.2;

function renderParagraph(paragraph: string) {
  return getInlineIconSegments(paragraph, NARRATIVE_TERMS).map(
    (segment, segmentIndex) => {
      if (segment.kind === "icon") {
        return (
          <span
            key={`icon-${segmentIndex}`}
            data-fill-unit=""
            data-kind="term"
            className="scroll-fill-term whitespace-nowrap"
          >
            <segment.Icon className="scroll-fill-glyph" aria-hidden="true" />
            {segment.term}
          </span>
        );
      }
      return segment.text.split(" ").map((word, wordIndex, words) => (
        <span key={`word-${segmentIndex}-${wordIndex}`}>
          {[...word].map((char, charIndex) => (
            <span
              key={charIndex}
              data-fill-unit=""
              data-kind="char"
              className="scroll-fill-char"
            >
              {char}
            </span>
          ))}
          {wordIndex < words.length - 1 ? " " : null}
        </span>
      ));
    }
  );
}

/**
 * US Mobile-style scroll narrative: the three paragraphs form ONE
 * sequential sweep, muted to primary character by character with a short
 * accent pre-echo at the frontier, scrubbed to scroll progress (reverses
 * on scroll up). Filling starts only when the section is comfortably in
 * view and spans a fixed scroll runway, so exactly one frontier exists at
 * any moment: one paragraph fills while the rest wait their turn. No
 * animation library, no pinning: progress derives from the section's
 * position inside a rAF callback. Reduced motion renders everything
 * filled and static.
 */
export function ScrollFillNarrative({
  paragraphs,
  className,
}: {
  paragraphs: readonly string[];
  className?: string;
}) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const units = Array.from(
      root.querySelectorAll<HTMLElement>("[data-fill-unit]")
    );
    if (!units.length) return;
    let frontier = -1;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;

    const apply = (next: number) => {
      for (let index = 0; index < units.length; index++) {
        const unit = units[index];
        const filled = index <= next;
        if (unit.dataset.kind === "term") {
          unit.classList.toggle("is-filled", filled);
        } else {
          unit.classList.toggle("is-filled", filled);
          unit.classList.toggle(
            "is-edge",
            index > next && index <= next + FILL_EDGE_UNITS
          );
        }
      }
      frontier = next;
    };

    const measure = () => {
      raf = 0;
      if (reduced.matches) {
        if (frontier !== units.length) apply(units.length);
        return;
      }
      const top = root.getBoundingClientRect().top;
      const startLine = window.innerHeight * START_LINE_RATIO;
      const runway = window.innerHeight * FILL_RUNWAY_RATIO;
      const progress = Math.min(1, Math.max(0, (startLine - top) / runway));
      const next = Math.round(progress * units.length);
      if (next !== frontier) apply(next);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [paragraphs]);

  return (
    <section
      ref={rootRef}
      aria-label="What ReacherX does"
      className={cn("marketing-scroll-fill", className)}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:py-32 lg:py-40">
        {paragraphs.map((paragraph, paragraphIndex) => (
          <p
            key={paragraphIndex}
            className={cn(
              "text-xl leading-[1.4] font-medium tracking-tight text-pretty sm:text-2xl lg:text-3xl lg:leading-[1.35]",
              paragraphIndex > 0 && "mt-8"
            )}
          >
            <span className="sr-only">{paragraph}</span>
            <span aria-hidden="true">{renderParagraph(paragraph)}</span>
          </p>
        ))}
      </div>
    </section>
  );
}
