"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useHeroRotation } from "@/features/landing/lib/heroRotationStore";

/**
 * Rotating headline word using the FlipText mechanic: each character is a
 * persistent slot that does one full 360° roll with a small lift when the
 * word swaps — no fades, no mount gaps. Driven by the shared hero rotation
 * store so it stays in lockstep with the composer placeholder.
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
  const isFirstRender = useRef(true);

  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  return (
    <span className={className}>
      <span className="sr-only">{srText ?? words[0]}</span>
      <span aria-hidden="true" className="inline-block whitespace-pre">
        {prefersReducedMotion
          ? word
          : word.split("").map((char, charIndex) => (
              <motion.span
                key={`${index}-${charIndex}`}
                className="inline-block whitespace-pre"
                initial={
                  isFirstRender.current
                    ? false
                    : { rotateX: 360, y: -8 }
                }
                animate={{ rotateX: 0, y: 0 }}
                transition={{
                  duration: 0.4,
                  ease: "easeOut",
                  delay: charIndex * 0.045,
                }}
              >
                {char}
              </motion.span>
            ))}
      </span>
    </span>
  );
}
