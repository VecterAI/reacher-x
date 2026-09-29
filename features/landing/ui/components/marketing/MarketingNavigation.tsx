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
  eyebrow: string;
  active: boolean;
  /** Plain text columns in the panel, Vercel-style. */
  columns: NavigationLink[][];
};

const resources: NavigationLink[] = [
  { href: "/blog/getting-started-with-reacherx", label: "Getting started" },
  { href: "/blog", label: "Blog" },
  { href: "/blog/category/comparisons", label: "Compare tools" },
  { href: "/blog/category/announcements", label: "What's new" },
  { href: "/blog/run-reacherx-yourself", label: "Self-hosting" },
];

const communityLinks: NavigationLink[] = [
  { href: DISCORD_INVITE_URL, label: "Join the Discord", external: true },
  { href: PATREON_URL, label: "Support on Patreon", external: true },
  {
    href: GITHUB_REPO_ISSUES_URL,
    label: "Contribute on GitHub",
    external: true,
  },
];

const useCaseColumns: NavigationLink[][] = [
  MARKETING_USE_CASES.slice(0, 4).map((item) => ({
    href: item.blogHref,
    label: item.title,
  })),
  MARKETING_USE_CASES.slice(4).map((item) => ({
    href: item.blogHref,
    label: item.title,
  })),
];

function isActiveHref(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const activeLinkClass =
  "text-foreground decoration-primary underline decoration-2 underline-offset-[8px]";

const triggerClass =
  "group flex items-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

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
  const [open, setOpen] = useState(false);
  const isUseCasesActive = MARKETING_USE_CASES.some((useCase) =>
    isActiveHref(useCase.blogHref, pathname)
  );
  const isResourcesActive =
    isActiveHref("/blog", pathname) && !isUseCasesActive;

  const groups: NavigationGroup[] = [
    {
      label: "Use cases",
      eyebrow: "Who do you want to find?",
      active: isUseCasesActive,
      columns: useCaseColumns,
    },
    {
      label: "Resources",
      eyebrow: "Learn about ReacherX",
      active: isResourcesActive,
      columns: [resources],
    },
    {
      label: "Community",
      eyebrow: "Build ReacherX with us",
      active: false,
      columns: [communityLinks],
    },
  ];

  return (
    <NavigationMenu.Root
      aria-label="Main navigation"
      data-rx-marketing-nav=""
      className="hidden justify-self-center xl:block"
      onValueChange={(value) => setOpen(Boolean(value))}
    >
      <NavigationOverlay open={open} />
      <NavigationMenu.List className="flex list-none items-center gap-1">
        {groups.map((group) => (
          <NavigationMenu.Item key={group.label}>
            <NavigationMenu.Trigger
              className={cn(triggerClass, group.active && activeLinkClass)}
            >
              {group.label}
              <KeyboardArrowDownIcon className="size-4 fill-current transition-transform group-data-[state=open]:rotate-180" />
            </NavigationMenu.Trigger>
            {/* Full-bleed panel anchored to the sticky header: no shadow, no
                radius, aligned with the page container like Vercel's menus. */}
            <NavigationMenu.Content className="border-border bg-background absolute inset-x-0 top-full border-b">
              <div className={cn(marketingPageWidth, "py-6 lg:py-8")}>
                <p className="text-muted-foreground text-sm leading-5">
                  {group.eyebrow}
                </p>
                <div
                  className={cn(
                    "mt-2 flex flex-col gap-x-16 gap-y-6 sm:flex-row"
                  )}
                >
                  {group.columns.map((column, columnIndex) => (
                    <ul key={columnIndex} className="list-none">
                      {column.map((link) => {
                        const linkActive =
                          !link.external && isActiveHref(link.href, pathname);
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
                      })}
                    </ul>
                  ))}
                </div>
              </div>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        ))}
        <NavigationMenu.Item>
          <NavigationMenu.Link
            asChild
            active={isActiveHref("/pricing", pathname)}
          >
            <Link
              href="/pricing"
              aria-current={
                isActiveHref("/pricing", pathname) ? "page" : undefined
              }
              className={cn(
                triggerClass,
                isActiveHref("/pricing", pathname) && activeLinkClass
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
