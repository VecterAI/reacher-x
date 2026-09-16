"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu } from "radix-ui";
import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import {
  DISCORD_INVITE_URL,
  PATREON_URL,
} from "@/features/landing/lib/communityUrls";
import { GITHUB_REPO_ISSUES_URL, GITHUB_REPO_URL } from "@/features/landing/lib/github";
import { workspaceUseCaseIcons } from "@/shared/ui/components/icons/workspaceUseCaseIconHelpers";
import { cn } from "@/shared/lib/utils";
import { marketingPageWidth } from "./MarketingLayout";
import {
  KeyboardArrowDownIcon,
  SearchIcon,
  NewsstandIcon,
  GitHubOutlineIcon,
  DeveloperGuideIcon,
  CampaignIcon,
  DiscordOutlineIcon,
  PatreonIcon,
} from "@/shared/ui/components/icons";

const resources = [
  {
    href: "/blog/getting-started-with-reacherx",
    label: "Getting started",
    description: "Set up your first workspace",
    icon: DeveloperGuideIcon,
  },
  {
    href: "/blog",
    label: "Blog",
    description: "Guides, ideas, and product notes",
    icon: NewsstandIcon,
  },
  {
    href: "/blog/category/comparisons",
    label: "Compare tools",
    description: "Where ReacherX fits",
    icon: SearchIcon,
  },
  {
    href: "/blog/category/announcements",
    label: "What's new",
    description: "The latest changes",
    icon: CampaignIcon,
  },
  {
    href: "/blog/run-reacherx-yourself",
    label: "Self-hosting",
    description: "Run the open-source app",
    icon: GitHubOutlineIcon,
  },
];

type NavigationLink = {
  href: string;
  label: string;
  description: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  /** External links open in a new tab and never match the active route. */
  external?: boolean;
};

type NavigationGroup = {
  label: string;
  eyebrow: string;
  active: boolean;
  links: NavigationLink[];
  all?: string;
  allLabel?: string;
};

const communityLinks: NavigationLink[] = [
  {
    href: DISCORD_INVITE_URL,
    label: "Join the Discord",
    description: "Ask questions and share what you build",
    icon: DiscordOutlineIcon,
    external: true,
  },
  {
    href: PATREON_URL,
    label: "Support on Patreon",
    description: "Fund development and keep ReacherX open source",
    icon: PatreonIcon,
    external: true,
  },
  {
    href: GITHUB_REPO_ISSUES_URL,
    label: "Contribute on GitHub",
    description: "Issues, pull requests, and good first tasks",
    icon: GitHubOutlineIcon,
    external: true,
  },
];

function isActiveHref(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const activeLinkClass =
  "text-foreground decoration-primary underline decoration-2 underline-offset-[8px]";

/**
 * Dim + blur the page while a menu is open. Portaled to <body> so it sits
 * under the sticky header (z-50) but above the page. Theme-aware via the
 * background token; clicking it dismisses the menu (Radix outside-press).
 */
function NavigationOverlay({ open }: { open: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !open) return null;
  return createPortal(
    <div
      aria-hidden="true"
      className="bg-background/40 animate-in fade-in fixed inset-0 z-40 backdrop-blur-sm duration-200"
    />,
    document.body
  );
}

export function MarketingNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const linkClass =
    "block rounded-md px-3 py-2 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
  const isUseCasesActive = MARKETING_USE_CASES.some(
    (useCase) =>
      isActiveHref(useCase.href, pathname) ||
      isActiveHref(useCase.blogHref, pathname)
  );
  const isResourcesActive =
    isActiveHref("/blog", pathname) && !isUseCasesActive;

  const groups: NavigationGroup[] = [
    {
      label: "Use cases",
      eyebrow: "Who do you want to find?",
      active: isUseCasesActive,
      links: MARKETING_USE_CASES.map((item) => ({
        href: item.blogHref,
        label: item.title,
        description: item.navigationDescription,
        icon: workspaceUseCaseIcons[item.useCaseKey],
      })),
    },
    {
      label: "Resources",
      eyebrow: "Learn about ReacherX",
      active: isResourcesActive,
      links: resources,
      all: "/blog",
      allLabel: "Read the blog",
    },
    {
      label: "Community",
      eyebrow: "Build ReacherX with us",
      active: false,
      links: communityLinks,
      all: GITHUB_REPO_URL,
      allLabel: "Star on GitHub",
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
        <NavigationMenu.Item>
          <NavigationMenu.Link
            asChild
            active={isActiveHref("/product", pathname)}
          >
            <Link
              href="/product"
              aria-current={
                isActiveHref("/product", pathname) ? "page" : undefined
              }
              className={cn(
                linkClass,
                isActiveHref("/product", pathname) && activeLinkClass
              )}
            >
              Product
            </Link>
          </NavigationMenu.Link>
        </NavigationMenu.Item>
        {groups.map((group) => (
          <NavigationMenu.Item key={group.label}>
            <NavigationMenu.Trigger
              className={cn(
                linkClass,
                "group flex items-center gap-1",
                group.active && activeLinkClass
              )}
            >
              {group.label}
              <KeyboardArrowDownIcon className="size-4 fill-current transition-transform group-data-[state=open]:rotate-180" />
            </NavigationMenu.Trigger>
            {/* Full-bleed panel anchored to the sticky header: no shadow, no
                radius, aligned with the page container like Vercel's menus. */}
            <NavigationMenu.Content className="border-border bg-background absolute inset-x-0 top-full border-b">
              <div className={cn(marketingPageWidth, "py-6 lg:py-8")}>
                <p className="text-muted-foreground mb-3 text-xs">
                  {group.eyebrow}
                </p>
                <ul className="grid gap-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                  {group.links.map((link) => {
                    const linkActive =
                      !link.external && isActiveHref(link.href, pathname);
                    const linkClassName = cn(
                      linkClass,
                      "group flex items-start gap-3 rounded-lg py-3",
                      linkActive &&
                        "bg-muted/60 text-foreground data-[active]:bg-muted/60"
                    );
                    const linkContent = (
                      <>
                        <link.icon
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 size-5 shrink-0",
                            link.icon !== GitHubOutlineIcon &&
                              link.icon !== DiscordOutlineIcon &&
                              "fill-current"
                          )}
                        />
                        <span>
                          <span className="text-foreground block text-sm font-medium">
                            {link.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-pretty">
                            {link.description}
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <li key={link.href}>
                        <NavigationMenu.Link asChild active={linkActive}>
                          {link.external ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={linkClassName}
                            >
                              {linkContent}
                            </a>
                          ) : (
                            <Link
                              href={link.href}
                              aria-current={
                                linkActive ? "page" : undefined
                              }
                              className={linkClassName}
                            >
                              {linkContent}
                            </Link>
                          )}
                        </NavigationMenu.Link>
                      </li>
                    );
                  })}
                </ul>
                {group.all ? (
                  <div className="border-border mt-4 border-t pt-1">
                    <NavigationMenu.Link asChild>
                      {group.all.startsWith("http") ? (
                        <a
                          href={group.all}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:bg-muted mt-1 block w-fit rounded-md px-3 py-2 text-sm font-medium"
                        >
                          {group.allLabel} ↗
                        </a>
                      ) : (
                        <Link
                          href={group.all}
                          className="hover:bg-muted mt-1 block w-fit rounded-md px-3 py-2 text-sm font-medium"
                        >
                          {group.allLabel} ↗
                        </Link>
                      )}
                    </NavigationMenu.Link>
                  </div>
                ) : null}
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
                linkClass,
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
