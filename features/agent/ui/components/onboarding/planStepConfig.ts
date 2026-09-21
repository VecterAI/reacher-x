/**
 * Static copy and pricing for the onboarding Plan step (UI only).
 * Checkout and server-backed pricing can replace these values later.
 */

export type OnboardingPlanTierId = "hobby" | "base" | "pro";

import type { BillingPeriod } from "@/shared/lib/billing/planOfferHelpers";
export type { BillingPeriod } from "@/shared/lib/billing/planOfferHelpers";

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
      "Find people, check matches, gather details, and reach out, 24/7",
      "100 people who match per workspace / month",
      "1 workspace",
      "Built-in CRM that updates itself",
      "Built-in memory for how you write and who you look for",
      "Send images, video, and voice notes",
      "Post, like, and comment from the same app",
      "Read and reply to X/Twitter and LinkedIn DMs in one place",
      "View full X/Twitter and LinkedIn profiles",
      "Emails and phone numbers shown when found",
      "Analytics for replies, conversations, and results",
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
    features: [
      "X/Twitter + LinkedIn integrated",
      "Find people, check matches, gather details, and reach out, 24/7",
      "1000 people who match per workspace / month",
      "2 workspaces",
      "Built-in CRM that updates itself",
      "Built-in memory for how you write and who you look for",
      "Send images, video, and voice notes",
      "Post, like, and comment from the same app",
      "Read and reply to X/Twitter and LinkedIn DMs in one place",
      "View full X/Twitter and LinkedIn profiles",
      "Emails and phone numbers shown when found",
      "Analytics for replies, conversations, and results",
      "Priority support",
      "Calendar integration (Coming soon)",
      "Send emails directly (Coming soon)",
      "Unified inbox: X/Twitter, LinkedIn, and email (Coming soon)",
      "MCP server (Coming soon)",
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
    features: [
      "X/Twitter + LinkedIn integrated",
      "Find people, check matches, gather details, and reach out, 24/7",
      "Unlimited people who match per workspace / month",
      "5 workspaces",
      "Built-in CRM that updates itself",
      "Built-in memory for how you write and who you look for",
      "Send images, video, and voice notes",
      "Post, like, and comment from the same app",
      "Read and reply to X/Twitter and LinkedIn DMs in one place",
      "View full X/Twitter and LinkedIn profiles",
      "Emails and phone numbers shown when found",
      "Analytics for replies, conversations, and results",
      "Priority support",
      "Calendar integration (Coming soon)",
      "Send emails directly (Coming soon)",
      "Unified inbox: X/Twitter, LinkedIn, and email (Coming soon)",
      "MCP server (Coming soon)",
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
