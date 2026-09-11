import type { CSSProperties } from "react";
import { createStableHash } from "@/convex/lib/memoryHelpers";

// Vivid Explore covers: deep color, saturated midtone, luminous accent.
const BLOG_GRADIENT_PALETTES = [
  ["#004ce6", "#00c9a7", "#d4ff00"],
  ["#a5003f", "#ff3e54", "#ffb000"],
  ["#1721a8", "#0066ff", "#00e5ff"],
  ["#006149", "#3cdb37", "#ebff00"],
  ["#6600bd", "#ec008c", "#ff805b"],
  ["#b51d00", "#ff6a00", "#ffe600"],
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
