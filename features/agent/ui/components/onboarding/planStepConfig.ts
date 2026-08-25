/**
 * Static copy and pricing for the onboarding Plan step (UI only).
 * Checkout and server-backed pricing can replace these values later.
 */

export type OnboardingPlanTierId = "hobby" | "base" | "pro";

export type BillingPeriod = "monthly" | "yearly";

export interface OnboardingPlanTierConfig {
  id: OnboardingPlanTierId;
  title: string;
  subtitle: string;
  badge?: string;
  /** Shown as a bold lead line before the checklist when set */
  featureLeadIn?: string;
  features: string[];
  pricing: {
    monthly: { amount: number | null };
    yearly: { amount: number | null };
    /** Optional compare-at price for monthly billing */
    strikethroughMonthly?: number;
    /** Optional compare-at price for yearly billing */
    strikethroughYearly?: number;
  };
}

/** Yearly amounts charge 10 months for 12 months of access. */
const HOBBY_MONTHLY = 9.99;
const BASE_MONTHLY = 49.99;
const PRO_MONTHLY = 99.99;
const PRO_COMPARE_MONTHLY = 199.99;

function yearlyWithTwoMonthsFree(monthlyAmount: number): number {
  return Number((monthlyAmount * 10).toFixed(2));
}

export const ONBOARDING_PLAN_TIERS: OnboardingPlanTierConfig[] = [
  {
    id: "hobby",
    title: "Hobby",
    subtitle: "Perfect for testing the waters.",
    features: [
      "X/Twitter + LinkedIn integrated",
      "24/7 sourcing, qualification, enrichment & outreach",
      "100 qualified prospects per workspace / month",
      "1 workspace",
      "Email support",
    ],
    pricing: {
      monthly: { amount: HOBBY_MONTHLY },
      yearly: { amount: yearlyWithTwoMonthsFree(HOBBY_MONTHLY) },
    },
  },
  {
    id: "base",
    title: "Base",
    subtitle: "For individuals running outreach regularly.",
    featureLeadIn: "Everything in Hobby, plus:",
    features: [
      "1000 qualified prospects per workspace / month",
      "2 workspaces",
      "Priority support",
    ],
    pricing: {
      monthly: { amount: BASE_MONTHLY },
      yearly: { amount: yearlyWithTwoMonthsFree(BASE_MONTHLY) },
    },
  },
  {
    id: "pro",
    title: "Pro",
    badge: "50% off · Limited time",
    subtitle: "For power users and growing teams.",
    featureLeadIn: "Everything in Base, plus:",
    features: [
      "Unlimited qualified prospects per workspace / month",
      "5 workspaces",
      "Calendar integration (Coming soon)",
      "Priority support",
    ],
    pricing: {
      monthly: { amount: PRO_MONTHLY },
      yearly: { amount: yearlyWithTwoMonthsFree(PRO_MONTHLY) },
      strikethroughMonthly: PRO_COMPARE_MONTHLY,
      strikethroughYearly: Number((PRO_COMPARE_MONTHLY * 12).toFixed(2)),
    },
  },
];

export function formatPlanPriceLabel(
  amount: number,
  billing: BillingPeriod
): string {
  return `$${amount.toFixed(2)}${billing === "monthly" ? "/mo" : "/yr"}`;
}
