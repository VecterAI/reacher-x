/** Decorative histogram for fit score (0–100), 40 bins. Used until real distribution is wired. */
export const PREFERENCE_FIT_SCORE_BIN_COUNTS: number[] = Array.from(
  { length: 40 },
  (_, i) => {
    const t = (i + 0.5) / 40;
    const mu = 0.72;
    const sigma = 0.14;
    const h = Math.exp(-0.5 * ((t - mu) / sigma) ** 2);
    return Math.max(1, Math.round(h * 44));
  }
);
