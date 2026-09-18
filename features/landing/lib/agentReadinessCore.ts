import {
  isPlanOfferAvailable,
  type PlanOffer,
  PLAN_OFFERS_UNAVAILABLE,
} from "@/shared/lib/billing/planOfferHelpers";
import {
  BLOG_DESCRIPTION,
  BLOG_ORIGIN,
  blogHref,
  filterBlogPosts,
  getBlogCategory,
  getPublishedBlogCategories,
  type BlogPostSummary,
} from "@/features/blog/lib/blogHelpers";
import {
  ONBOARDING_PLAN_TIERS,
  formatPlanPriceLabel,
} from "@/features/agent/ui/components/onboarding/planStepConfig";
import { homepageFaqItems, pricingFaqItems, type FaqItem } from "./faqs";
import {
  MARKETING_COPY,
  MARKETING_CAPABILITY_CONTENT,
} from "./marketingContentHelpers";
import {
  MARKETING_USE_CASES,
  getMarketingUseCase,
} from "./marketingUseCaseHelpers";
import { PUBLIC_MARKETING_PAGES } from "./agentReadinessHelpers";
import { GITHUB_REPO_URL } from "./github";
import { DISCORD_INVITE_URL, PATREON_URL } from "./communityUrls";

const link = (label: string, path: string) =>
  `[${label}](${BLOG_ORIGIN}${path})`;
const faqs = (items: FaqItem[]) =>
  `## Frequently asked questions\n\n${items.map((item) => `### ${item.question}\n\n${item.answer}`).join("\n\n")}`;
const useCases = () =>
  MARKETING_USE_CASES.map(
    (item) =>
      `- ${link(item.goal, item.href)}: ${item.explanation}\n  ${link("Read the walkthrough", item.blogHref)}`
  ).join("\n");
const footer = `## More information\n\n${PUBLIC_MARKETING_PAGES.slice(0, 4)
  .map((page) => `- ${link(page.title, page.href)}`)
  .join(
    "\n"
  )}\n- ${link("Blog and guides", "/blog")}\n- ${link("Agent reading index", "/llms.txt")}\n- [Source code and self-hosting](${GITHUB_REPO_URL})\n- [Discord community](${DISCORD_INVITE_URL})\n- [Support on Patreon](${PATREON_URL})\n- [Contact ReacherX](mailto:creativecoder.crco@gmail.com)`;

/** Uses the same editorial copy, prices, use cases and published posts as the UI. */
export function publicPageMarkdown(
  pathname: string,
  posts: BlogPostSummary[],
  query = "",
  offers: readonly PlanOffer[] = []
): string | null {
  let title: string;
  let body: string;
  if (pathname === "/home") {
    title = "Reach the right people.";
    body = [
      MARKETING_COPY.home.description,
      "## How it works",
      ...Object.values(MARKETING_COPY.workflow),
      ...Object.values(MARKETING_COPY.story),
      "## Who you can find",
      useCases(),
      faqs(homepageFaqItems),
    ].join("\n\n");
  } else if (pathname === "/product") {
    title = MARKETING_COPY.productPage.heading;
    body = [
      MARKETING_COPY.productPage.description,
      "## Capabilities",
      ...Object.values(MARKETING_COPY.product),
      ...MARKETING_CAPABILITY_CONTENT.map(
        (item) =>
          `### ${item.title}\n\n${item.body}\n\n${link("Read the guide", item.href)}`
      ),
      faqs(homepageFaqItems),
    ].join("\n\n");
  } else if (pathname === "/pricing") {
    title = "Pricing";
    body = `Prices in USD.\n\n${
      ONBOARDING_PLAN_TIERS.filter((tier) =>
        offers.some((offer) => offer.tier === tier.id)
      )
        .map(
          (tier) =>
            `## ${tier.title}\n\n${tier.subtitle}\n\n${(
              ["monthly", "yearly"] as const
            )
              .filter((period) => isPlanOfferAvailable(offers, tier.id, period))
              .map((period) => {
                const amount = tier.pricing[period].amount;
                return amount === null
                  ? ""
                  : `${period === "monthly" ? "Monthly" : "Yearly"}: ${formatPlanPriceLabel(amount, period)}`;
              })
              .join(
                "\n\n"
              )}\n\n${tier.featureLeadIn ?? ""}\n\n${tier.features.map((feature) => `- ${feature}`).join("\n")}`
        )
        .join("\n\n") || PLAN_OFFERS_UNAVAILABLE
    }\n\n${faqs(pricingFaqItems)}`;
  } else if (pathname === "/use-cases") {
    title = "Who are you looking for?";
    body = `${MARKETING_COPY.useCases.description}\n\n${useCases()}`;
  } else if (pathname.startsWith("/use-cases/")) {
    const item = getMarketingUseCase(pathname.slice("/use-cases/".length));
    if (!item) return null;
    title = item.heading;
    body = `${item.explanation}\n\n## ${item.exampleHeading}\n\n${item.checks.map((check) => `- ${check}`).join("\n")}\n\n${link("Read the walkthrough", item.blogHref)}`;
  } else if (pathname === "/blog" || pathname.startsWith("/blog/category/")) {
    const category =
      pathname === "/blog"
        ? undefined
        : getBlogCategory(pathname.slice("/blog/category/".length));
    if (
      pathname !== "/blog" &&
      (!category || !posts.some((post) => post.category === category.slug))
    )
      return null;
    title = category?.label ?? "ReacherX Blog";
    const selected = filterBlogPosts(
      category
        ? posts.filter((post) => post.category === category.slug)
        : posts,
      query
    );
    body = `${category?.description ?? BLOG_DESCRIPTION}\n\n${selected.length ? selected.map((post) => `- ${link(post.title, blogHref(post.slug))}: ${post.description}\n  Published: ${post.date}. ${link("Markdown", `${blogHref(post.slug)}/markdown`)}`).join("\n") : "No posts match your search."}`;
  } else return null;
  return `# ${title}\n\nCanonical: ${BLOG_ORIGIN}${pathname}\n\n${body}\n\n${footer}\n`;
}

export function buildAgentReadingIndex(posts: BlogPostSummary[]) {
  return `# ReacherX\n\n> ${homepageFaqItems[0].answer}\n\n## When to use ReacherX\n\nUse ReacherX when someone needs to find and research relevant people on X/Twitter or LinkedIn and prepare personal outreach. ${homepageFaqItems.find((item) => item.id === "approval")!.answer}\n\nThe public pages describe the product. Using the hosted app requires sign-in, setup, and a paid plan. The interactive demos use fictional data. They do not send real messages. Start with the product and pricing pages and the getting-started guide; do not treat marketing examples as live account data.\n\n## Product and use cases\n\n${PUBLIC_MARKETING_PAGES.map((page) => `- ${link(page.title, page.href)}: ${page.description}`).join("\n")}\n\n## Guides and blog\n\n- ${link("Blog", "/blog")}: all published posts.\n${getPublishedBlogCategories(
    posts
  )
    .map(
      (category) =>
        `- ${link(category.label, `/blog/category/${category.slug}`)}: ${category.description}`
    )
    .join(
      "\n"
    )}\n${posts.map((post) => `- ${link(post.title, blogHref(post.slug))}: ${post.description}`).join("\n")}\n\n## Reading formats\n\nPublic marketing pages, blog listings, and articles support Accept: text/markdown. Each page advertises its Markdown URL through a Link header and alternate metadata.\n\n- ${link("XML sitemap", "/sitemap.xml")}\n- ${link("Blog Markdown index", "/blog/sitemap.md")}\n- ${link("RSS feed", "/blog/feed.xml")}\n- [Source code](${GITHUB_REPO_URL})\n- [Contact](mailto:creativecoder.crco@gmail.com)\n`;
}
