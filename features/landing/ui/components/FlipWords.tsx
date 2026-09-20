"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useHeroRotation } from "@/features/landing/lib/heroRotationStore";

/** Shared vanishing point: one perspective on the wrapper, not per character. */
const WRAPPER_STYLE = { perspective: "900px" } as const;
const PRESERVE_3D = { transformStyle: "preserve-3d" } as const;
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Rotating headline word driven by the shared hero rotation store, so it
 * stays in lockstep with the composer placeholder examples.
 *
 * Smoothness comes from: a single shared perspective, a quick staggered
 * flip-out of the outgoing word before the incoming word flips in, and one
 * eased spring-like curve for all characters. First paint renders the first
 * word statically (SSR and no-JS safe); reduced motion swaps instantly.
 */
export function FlipWords({
  words,
  srText,
  className,
}: {
  words: readonly string[];
  srText?: string;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const rotation = useHeroRotation(true);
  const index = rotation.index % words.length;
  const word = words[index] ?? "";

  return (
    <span className={className}>
      <span className="sr-only">{srText ?? words[0]}</span>
      <span
        aria-hidden="true"
        className="inline-block align-baseline"
        style={WRAPPER_STYLE}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={prefersReducedMotion ? "static" : index}
            className="inline-block whitespace-pre"
            style={PRESERVE_3D}
          >
            {word.split("").map((char, charIndex) =>
              prefersReducedMotion ? (
                char
              ) : (
                <motion.span
                  key={charIndex}
                  className="inline-block whitespace-pre"
                  style={{ backfaceVisibility: "hidden" }}
                  initial={{ rotateX: -90, opacity: 0 }}
                  animate={{
                    rotateX: 0,
                    opacity: 1,
                    transition: {
                      duration: 0.45,
                      delay: charIndex * 0.026,
                      ease: EASE_OUT,
                    },
                  }}
                  exit={{
                    rotateX: 90,
                    opacity: 0,
                    transition: {
                      duration: 0.25,
                      delay: charIndex * 0.012,
                      ease: "easeIn",
                    },
                  }}
                >
                  {char}
                </motion.span>
              )
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
