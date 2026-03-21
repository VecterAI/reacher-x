import Image from "next/image";

/**
 * Shared graphic for all use-case rows. Replace `public/onboarding/use-case-placeholder.svg`
 * with your full artwork (same path) or swap this component to per-key illustrations.
 */
export function SharedUseCaseIllustrationSvg() {
  return (
    <Image
      alt=""
      src="/onboarding/use-case-placeholder.svg"
      width={64}
      height={64}
      decoding="async"
      className="size-16 shrink-0 rounded-lg object-cover"
      aria-hidden
    />
  );
}
