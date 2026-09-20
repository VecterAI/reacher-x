"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const FLIP_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
const DEFAULT_INTERVAL_MS = 3400;

/**
 * Rotating word with a per-character flip for marketing headlines.
 * First paint renders the first word statically (SSR and no-JS safe); swaps
 * happen client-side only. With reduced motion the word swaps instantly.
 */
export function FlipWords({
  words,
  intervalMs = DEFAULT_INTERVAL_MS,
  srText,
  className,
}: {
  words: string[];
  intervalMs?: number;
  srText?: string;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    const id = window.setInterval(
      () => setIndex((current) => (current + 1) % words.length),
      intervalMs
    );
    return () => window.clearInterval(id);
  }, [words.length, intervalMs]);

  const word = words[index] ?? "";

  return (
    <span className={className}>
      <span className="sr-only">{srText ?? words[0]}</span>
      <span aria-hidden="true" className="inline-block">
        {word.split("").map((char, charIndex) =>
          prefersReducedMotion ? (
            char
          ) : (
            <motion.span
              key={`${index}-${charIndex}`}
              className="inline-block whitespace-pre"
              initial={{ rotateX: 90, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              transition={{
                duration: 0.4,
                delay: charIndex * 0.035,
                ease: FLIP_EASE,
              }}
              style={{ transformPerspective: 600 }}
            >
              {char}
            </motion.span>
          )
        )}
      </span>
    </span>
  );
}
