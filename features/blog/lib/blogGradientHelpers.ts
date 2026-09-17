import type { CSSProperties } from "react";
import { createStableHash } from "@/convex/lib/memoryHelpers";

// Neutral Explore covers, from charcoal through silver.
const BLOG_GRADIENT_PALETTES = [
  ["#171717", "#525252", "#d4d4d4"],
  ["#262626", "#737373", "#e5e5e5"],
  ["#0a0a0a", "#404040", "#a3a3a3"],
  ["#171717", "#737373", "#d4d4d4"],
  ["#262626", "#525252", "#a3a3a3"],
  ["#404040", "#a3a3a3", "#e5e5e5"],
] as const;

/** Keep a post's palette and composition stable across pages and hydration. */
export function getBlogGradientStyle(
  slug: string
): CSSProperties & Record<`--blog-gradient-${string}`, string> {
  const seed = Number.parseInt(createStableHash(slug), 16);
  const [ink, color, light] =
    BLOG_GRADIENT_PALETTES[seed % BLOG_GRADIENT_PALETTES.length];
  return {
    "--blog-gradient-ink": ink,
    "--blog-gradient-color": color,
    "--blog-gradient-light": light,
    "--blog-gradient-angle": `${110 + ((seed >>> 8) % 120)}deg`,
    "--blog-gradient-origin": `${15 + ((seed >>> 16) % 65)}%`,
  };
}
