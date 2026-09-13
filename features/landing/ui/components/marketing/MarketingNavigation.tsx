"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu } from "radix-ui";
import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import { cn } from "@/shared/lib/utils";
import {
  KeyboardArrowDownIcon,
  AccountBoxIcon,
  HandshakeIcon,
  ForumIcon,
  MicIcon,
  SearchIcon,
  PaidIcon,
  CodeIcon,
  DescriptionIcon,
  ChangeCircleIcon,
  GitHubOutlineIcon,
  PlayCircleIcon,
} from "@/shared/ui/components/icons";

const useCaseIcons = [
  AccountBoxIcon,
  CodeIcon,
  PaidIcon,
  HandshakeIcon,
  ForumIcon,
  PlayCircleIcon,
  SearchIcon,
  MicIcon,
];

const resources = [
  {
    href: "/blog/getting-started-with-reacherx",
    label: "Getting started",
    description: "Set up your first project",
    icon: PlayCircleIcon,
  },
  {
    href: "/blog",
    label: "Blog",
    description: "Guides, ideas, and product notes",
    icon: DescriptionIcon,
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
    icon: ChangeCircleIcon,
  },
  {
    href: "/blog/run-reacherx-yourself",
    label: "Self-hosting",
    description: "Run the open-source app",
    icon: GitHubOutlineIcon,
  },
  {
    href: "/about",
    label: "About ReacherX",
    description: "Why Salman is building it",
    icon: AccountBoxIcon,
  },
];

export function MarketingNavigation() {
  const pathname = usePathname();
  const linkClass =
    "block rounded-md px-3 py-2 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <NavigationMenu.Root
      aria-label="Main navigation"
      className="relative hidden justify-self-center xl:block"
    >
      <NavigationMenu.List className="flex list-none items-center gap-1">
        <NavigationMenu.Item>
          <NavigationMenu.Link asChild active={pathname === "/product"}>
            <Link href="/product" className={linkClass}>
              Product
            </Link>
          </NavigationMenu.Link>
        </NavigationMenu.Item>
        {[
          {
            label: "Use cases",
            links: MARKETING_USE_CASES.map((item, index) => ({
              href: item.href,
              label: item.title,
              description: item.navigationDescription,
              icon: useCaseIcons[index],
            })),
            all: "/use-cases",
            allLabel: "Explore all use cases",
          },
          {
            label: "Resources",
            links: resources,
            all: "/blog",
            allLabel: "Read the blog",
          },
        ].map((group) => (
          <NavigationMenu.Item key={group.label}>
            <NavigationMenu.Trigger
              className={cn(linkClass, "group flex items-center gap-1")}
            >
              {group.label}
              <KeyboardArrowDownIcon className="size-4 fill-current transition-transform group-data-[state=open]:rotate-180" />
            </NavigationMenu.Trigger>
            <NavigationMenu.Content className="border-border bg-background absolute top-full left-1/2 mt-3 w-[640px] -translate-x-1/2 rounded-xl border p-3 shadow-lg">
              <p className="text-muted-foreground mb-2 px-3 pt-3 text-xs">
                {group.label === "Use cases"
                  ? "Who do you want to find?"
                  : "Learn about ReacherX"}
              </p>
              <ul className="grid grid-cols-2 gap-1">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <NavigationMenu.Link
                      asChild
                      active={pathname === link.href}
                    >
                      <Link
                        href={link.href}
                        className={cn(
                          linkClass,
                          "group flex items-start gap-3 py-4"
                        )}
                      >
                        <link.icon
                          aria-hidden="true"
                          className="mt-0.5 size-5 shrink-0 fill-current"
                        />
                        <span>
                          <span className="text-foreground block text-sm font-medium">
                            {link.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-pretty">
                            {link.description}
                          </span>
                        </span>
                      </Link>
                    </NavigationMenu.Link>
                  </li>
                ))}
              </ul>
              <NavigationMenu.Link asChild>
                <Link
                  href={group.all}
                  className="border-border hover:bg-muted mt-2 block rounded-b-lg border-t px-3 py-3 text-sm font-medium"
                >
                  {group.allLabel} ↗
                </Link>
              </NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        ))}
        <NavigationMenu.Item>
          <NavigationMenu.Link asChild active={pathname === "/pricing"}>
            <Link href="/pricing" className={linkClass}>
              Pricing
            </Link>
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
