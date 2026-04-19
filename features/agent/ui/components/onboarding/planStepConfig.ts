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

/** Yearly amounts assume 20% off the annualized monthly list (see Figma: Yearly · Save 20%). */
const BASE_MONTHLY = 49.99;
const PRO_MONTHLY = 99.99;
const PRO_COMPARE_MONTHLY = 199.99;

export const ONBOARDING_PLAN_TIERS: OnboardingPlanTierConfig[] = [
  {
    id: "hobby",
    title: "Hobby",
    subtitle: "Perfect for testing the waters.",
    features: [
      "X/Twitter + LinkedIn integrated",
      "24/7 prospecting, qualification, enrichment & outreach",
      "100 qualified prospects / month",
      "1 workspace",
      "Email support",
    ],
    pricing: {
      monthly: { amount: null },
      yearly: { amount: null },
    },
  },
  {
    id: "base",
    title: "Base",
    subtitle: "For individuals who prospect regularly.",
    featureLeadIn: "Everything in Free, plus:",
    features: [
      "1000 qualified prospects / month",
      "2 workspaces",
      "Workspace settings rollback",
      "Priority support",
    ],
    pricing: {
      monthly: { amount: BASE_MONTHLY },
      yearly: { amount: Number((BASE_MONTHLY * 12 * 0.8).toFixed(2)) },
    },
  },
  {
    id: "pro",
    title: "Pro",
    badge: "50% off · Limited time",
    subtitle: "For power users and growing teams.",
    featureLeadIn: "Everything in Base, plus:",
    features: [
      "Unlimited qualified prospects / month",
      "5 workspaces",
      "Workspace settings rollback",
      "Calendar integration",
      "Priority support",
    ],
    pricing: {
      monthly: { amount: PRO_MONTHLY },
      yearly: { amount: Number((PRO_MONTHLY * 12 * 0.8).toFixed(2)) },
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
