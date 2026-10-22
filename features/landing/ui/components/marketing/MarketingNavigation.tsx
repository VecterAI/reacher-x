"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu } from "radix-ui";
import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import {
  DISCORD_INVITE_URL,
  PATREON_URL,
} from "@/features/landing/lib/communityUrls";
import { GITHUB_REPO_ISSUES_URL } from "@/features/landing/lib/github";
import { cn } from "@/shared/lib/utils";
import { marketingPageWidth } from "./MarketingLayout";
import { KeyboardArrowDownIcon } from "@/shared/ui/components/icons";

type NavigationLink = {
  href: string;
  label: string;
  /** External links open in a new tab and never match the active route. */
  external?: boolean;
};

type NavigationGroup = {
  label: string;
  /** Marks the bar trigger when a panel route is active. */
  active: boolean;
  /** Featured zone on the left: eyebrow + one big link with arrow. */
  featuredEyebrow: string;
  featured: NavigationLink;
  /** Original link columns on the right, under their own eyebrow. */
  columnsEyebrow: string;
  columns: NavigationLink[][];
};

const communityLinks: NavigationLink[] = [
  { href: DISCORD_INVITE_URL, label: "Join the Discord", external: true },
  { href: PATREON_URL, label: "Support on Patreon", external: true },
  {
    href: GITHUB_REPO_ISSUES_URL,
    label: "Contribute on GitHub",
    external: true,
  },
];

const useCaseFeatured: NavigationLink = {
  href: "/blog/category/use-cases",
  label: "Use cases",
};

const useCaseColumns: NavigationLink[][] = [
  MARKETING_USE_CASES.map((item) => ({
    href: item.blogHref,
    label: item.title,
  })),
];

const resourcesFeatured: NavigationLink = { href: "/blog", label: "Blog" };

const resourceColumns: NavigationLink[][] = [
  [
    { href: "/blog/getting-started-with-reacherx", label: "Getting started" },
    { href: "/blog/category/comparisons", label: "Compare tools" },
    { href: "/blog/category/announcements", label: "What's new" },
    { href: "/blog/run-reacherx-yourself", label: "Self-hosting" },
  ],
];

const communityFeatured = communityLinks[0];
const communityColumns: NavigationLink[][] = [communityLinks.slice(1)];

function isActiveHref(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const activeLinkClass =
  "text-foreground decoration-primary underline decoration-2 underline-offset-[8px]";

const triggerClass =
  "group flex items-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

/** Featured zone: one big link with arrow, Polar-style. */
const featuredLinkClass =
  "text-foreground mt-2 block w-fit rounded-sm text-4xl leading-10 font-normal tracking-tight outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring underline-offset-4";

/** Panel link metrics follow the Vercel menu: text-xl/8, flush left. */
const panelLinkClass =
  "text-foreground block w-fit rounded-sm text-xl/8 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring underline-offset-4";

/**
 * Dim the page while a menu is open. Portaled to <body> so it sits under the
 * sticky header (z-50) but above the page. Clicking it dismisses the menu
 * (Radix outside-press). The menu only opens through client interaction, so
 * the portal never renders during SSR.
 */
function NavigationOverlay({ open }: { open: boolean }) {
  if (!open) return null;
  return createPortal(
    <div
      aria-hidden="true"
      className="animate-in fade-in fixed inset-0 z-40 bg-black/30 duration-200 dark:bg-black/70"
    />,
    document.body
  );
}

export function MarketingNavigation() {
  const pathname = usePathname();
  /** Which menu is open (Radix item value); null when all are closed. */
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const isUseCasesActive =
    isActiveHref(useCaseFeatured.href, pathname) ||
    MARKETING_USE_CASES.some((useCase) =>
      isActiveHref(useCase.blogHref, pathname)
    );
  const isResourcesActive =
    isActiveHref("/blog", pathname) && !isUseCasesActive;
  const isPricingActive = isActiveHref("/pricing", pathname);

  const groups: NavigationGroup[] = [
    {
      label: "Use cases",
      active: isUseCasesActive,
      featuredEyebrow: "Explore Use cases",
      featured: useCaseFeatured,
      columnsEyebrow: "Who do you want to find?",
      columns: useCaseColumns,
    },
    {
      label: "Resources",
      active: isResourcesActive,
      featuredEyebrow: "Explore Resources",
      featured: resourcesFeatured,
      columnsEyebrow: "Learn about ReacherX",
      columns: resourceColumns,
    },
    {
      label: "Community",
      active: false,
      featuredEyebrow: "Join the community",
      featured: communityFeatured,
      columnsEyebrow: "Build ReacherX with us",
      columns: communityColumns,
    },
  ];

  /** Shared renderer for the right-zone column links. */
  const renderPanelLink = (link: NavigationLink) => {
    const linkActive = !link.external && isActiveHref(link.href, pathname);
    return (
      <li key={link.href}>
        <NavigationMenu.Link asChild active={linkActive}>
          {link.external ? (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={panelLinkClass}
            >
              {link.label} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <Link
              href={link.href}
              aria-current={linkActive ? "page" : undefined}
              className={cn(
                panelLinkClass,
                linkActive && "underline decoration-2"
              )}
            >
              {link.label}
            </Link>
          )}
        </NavigationMenu.Link>
      </li>
    );
  };

  return (
    <NavigationMenu.Root
      aria-label="Main navigation"
      data-rx-marketing-nav=""
      className="hidden justify-self-center xl:block"
      onValueChange={(value) => setOpenMenu(value || null)}
    >
      <NavigationOverlay open={openMenu !== null} />
      <NavigationMenu.List className="flex list-none items-center gap-1">
        {groups.map((group) => {
          // Exact match only: on descendant routes (e.g. a blog post) the
          // featured link is not the current page. Group/trigger activity
          // keeps the prefix check above.
          const featuredActive =
            !group.featured.external && pathname === group.featured.href;
          return (
            <NavigationMenu.Item key={group.label} value={group.label}>
              <NavigationMenu.Trigger
                className={cn(
                  triggerClass,
                  // Active-route emphasis yields to whichever menu is open, so
                  // the open trigger is the single point of focus (Polar-style).
                  group.active &&
                    (openMenu === null || openMenu === group.label) &&
                    activeLinkClass,
                  openMenu === group.label && "text-foreground"
                )}
              >
                {group.label}
                <KeyboardArrowDownIcon className="size-4 fill-current transition-transform group-data-[state=open]:rotate-180" />
              </NavigationMenu.Trigger>
              {/* Full-bleed panel anchored to the sticky header: no shadow, no
                radius, aligned with the page container like Vercel's menus. */}
              <NavigationMenu.Content className="border-border bg-background absolute inset-x-0 top-full border-b">
                <div className={cn(marketingPageWidth, "py-6 lg:py-8")}>
                  {/* Featured zone on the left (one big link with arrow) and
                    the original columns on the right, Polar-style. Desktop
                    only; the nav root is hidden below xl. */}
                  <div className="grid grid-cols-[1fr_2fr] gap-x-16">
                    <div>
                      <p className="text-muted-foreground text-sm leading-5">
                        {group.featuredEyebrow}
                      </p>
                      <NavigationMenu.Link asChild active={featuredActive}>
                        <Link
                          href={group.featured.href}
                          target={
                            group.featured.external ? "_blank" : undefined
                          }
                          rel={
                            group.featured.external
                              ? "noopener noreferrer"
                              : undefined
                          }
                          aria-current={featuredActive ? "page" : undefined}
                          className={cn(
                            featuredLinkClass,
                            featuredActive && "underline decoration-2"
                          )}
                        >
                          {group.featured.label}{" "}
                          <span aria-hidden="true">↗</span>
                        </Link>
                      </NavigationMenu.Link>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm leading-5">
                        {group.columnsEyebrow}
                      </p>
                      <div className="mt-2 flex flex-row gap-x-16">
                        {group.columns.map((column, columnIndex) => (
                          <ul key={columnIndex} className="list-none">
                            {column.map((link) => renderPanelLink(link))}
                          </ul>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          );
        })}
        <NavigationMenu.Item>
          <NavigationMenu.Link asChild active={isPricingActive}>
            <Link
              href="/pricing"
              aria-current={isPricingActive ? "page" : undefined}
              className={cn(
                triggerClass,
                isPricingActive && openMenu === null && activeLinkClass
              )}
            >
              Pricing
            </Link>
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
