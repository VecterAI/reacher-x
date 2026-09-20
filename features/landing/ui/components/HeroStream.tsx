"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useHeroRotation } from "@/features/landing/lib/heroRotationStore";
import "./heroStream.css";

const SLIDE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Inline vertical text stream driven by the shared hero rotation store, so
 * every stream on the page (hero headline, composer placeholder) steps to
 * its aligned item at the same moment. One row slides up and out while the
 * next slides in from below, inside a hard-clipped one-line window.
 * The first item is exposed to screen readers; the stream is decorative.
 */
export function HeroStream({
  items,
  className,
}: {
  items: readonly string[];
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const rotation = useHeroRotation(true);
  const index = rotation.index % items.length;
  const item = items[index] ?? "";

  return (
    <>
      <span className="sr-only">{items[0]}</span>
      <span aria-hidden="true" className={`hero-stream ${className ?? ""}`}>
        {prefersReducedMotion ? (
          <span className="hero-stream__item">{item}</span>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={index}
              className="hero-stream__item"
              initial={{ y: "110%" }}
              animate={{ y: "0%" }}
              exit={{ y: "-110%" }}
              transition={{ duration: 0.55, ease: SLIDE_EASE }}
            >
              {item}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
    </>
  );
}
