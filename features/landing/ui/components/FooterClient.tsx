"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  GITHUB_REPO_ISSUES_URL,
  GITHUB_REPO_URL,
} from "@/features/landing/lib/github";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { LandingWordmark } from "@/features/landing/ui/components/LandingWordmark";
import { VecterAILogo } from "@/features/landing/ui/components/VecterAILogo";
import {
  Select,
  SelectContent,
  SelectSeparator,
  SelectTrigger,
} from "@/shared/ui/components/Select";
import {
  TwitterIcon,
  DiscordIcon,
  LinkedinIcon,
  BlueskyIcon,
  ThreadsIcon,
  ArrowUpwardIcon,
  ChangeCircleIcon,
  CheckIcon,
  LightModeIcon,
  DarkModeIcon,
} from "@/shared/ui/components/icons";

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Use cases", href: "/home/use-cases" },
      { label: "Pricing", href: "/home/pricing" },
      {
        label: "Changelog",
        href: "https://github.com/VecterAI/reacher-x/releases/",
      },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Threads", href: "/home/threads" },
      { label: "Contact", href: "mailto:support@reacherx.com" },
    ],
  },
  {
    title: "Open source",
    links: [
      { label: "GitHub", href: GITHUB_REPO_URL },
      {
        label: "Documentation",
        href: "https://github.com/VecterAI/reacher-x/blob/main/README.md",
      },
      { label: "Contribute", href: GITHUB_REPO_ISSUES_URL },
      {
        label: "License (MIT)",
        href: "https://github.com/VecterAI/reacher-x/blob/main/LICENSE",
      },
    ],
  },
] as const;

const SOCIALS = [
  {
    href: "https://x.com/ReacherXfounder",
    label: "X/Twitter",
    icon: <TwitterIcon />,
  },
  {
    href: "https://discord.gg/76dF9NPH",
    label: "Discord",
    icon: <DiscordIcon className="fill-current" />,
  },
  {
    href: "https://www.linkedin.com/in/noobships",
    label: "LinkedIn",
    icon: <LinkedinIcon className="fill-current" />,
  },
  {
    href: "https://bsky.app/profile/reacherxfounder.bsky.social",
    label: "Bluesky",
    icon: <BlueskyIcon className="stroke-current" />,
  },
  {
    href: "https://threads.net/@reacherxfounder",
    label: "Threads",
    icon: <ThreadsIcon className="fill-current" />,
  },
];

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: ChangeCircleIcon },
  { value: "light", label: "Light", icon: LightModeIcon },
  { value: "dark", label: "Dark", icon: DarkModeIcon },
] as const;

type ThemeOptionValue = (typeof THEME_OPTIONS)[number]["value"];

function isThemeOptionValue(value: string): value is ThemeOptionValue {
  return THEME_OPTIONS.some((option) => option.value === value);
}

function isLinkActive(href: string, pathname: string): boolean {
  if (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("http")
  )
    return false;
  if (href === pathname) return true;
  return pathname.startsWith(href + "/");
}

function ThemeSelectItem({
  value,
  icon: Icon,
  children,
}: {
  value: ThemeOptionValue;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="focus:bg-accent focus:text-accent-foreground flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50"
    >
      <Icon className="size-4 shrink-0 fill-current" aria-hidden="true" />
      <SelectPrimitive.ItemText className="flex-1">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ml-auto">
        <CheckIcon className="size-3.5 shrink-0 fill-current" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function FooterClient({
  className,
  currentYear,
}: {
  className?: string;
  currentYear: number;
}) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const themeValue = isThemeOptionValue(theme ?? "") ? theme : "system";
  const selectedThemeOption =
    THEME_OPTIONS.find((option) => option.value === themeValue) ??
    THEME_OPTIONS[0];

  const handleScrollToTop = React.useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <footer className={cn("border-border border-t", className)}>
      <div className="mx-auto flex w-full max-w-[1288px] flex-col gap-8 px-4 pt-8 pb-8 md:gap-12 md:pt-12 md:pb-12">
        <div className="flex flex-col gap-1">
          <LandingWordmark className="w-fit" />
          <address className="not-italic">
            <a
              href="mailto:support@reacherx.com"
              className="text-muted-foreground font-mono text-sm font-medium hover:underline"
            >
              support@reacherx.com
            </a>
          </address>
        </div>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {FOOTER_COLUMNS.map(({ title, links }) => (
            <div key={title} className="flex flex-col gap-3">
              <span className="text-muted-foreground text-sm font-medium">
                {title}
              </span>
              <ul className="flex flex-col gap-2">
                {links.map(({ label, href }) => {
                  const active = isLinkActive(href, pathname);
                  return (
                    <li key={label}>
                      {href.startsWith("http") ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline"
                        >
                          {label}
                        </a>
                      ) : href.startsWith("mailto:") ? (
                        <a href={href} className="text-sm hover:underline">
                          {label}
                        </a>
                      ) : (
                        <Link
                          href={href}
                          className={cn(
                            "text-sm hover:underline",
                            active &&
                              "font-medium underline decoration-2 underline-offset-4"
                          )}
                        >
                          {label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="hidden flex-col gap-3 md:flex">
            <span className="text-muted-foreground text-sm font-medium">
              Follow on
            </span>
            <div className="flex flex-wrap">
              {SOCIALS.map(({ href, label, icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    aria-label={`ReacherX on ${label}`}
                    variant="ghost"
                    size="icon"
                    className="[&_svg]:size-5"
                  >
                    {icon}
                  </Button>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:hidden">
          <span className="text-muted-foreground text-sm font-medium">
            Follow on
          </span>
          <div className="flex flex-wrap">
            {SOCIALS.map(({ href, label, icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  aria-label={`ReacherX on ${label}`}
                  variant="ghost"
                  size="icon"
                  className="[&_svg]:size-5"
                >
                  {icon}
                </Button>
              </a>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            className="w-fit"
            onClick={handleScrollToTop}
          >
            <ArrowUpwardIcon className="size-4 fill-current" />
            Go to top
          </Button>
          <Select
            value={themeValue}
            onValueChange={(value) => {
              if (!isThemeOptionValue(value)) return;
              setTheme(value);
            }}
          >
            <SelectTrigger
              aria-label="Select color theme"
              size="xs"
              className="w-auto shadow-none"
            >
              <span>{selectedThemeOption.label}</span>
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-sm font-medium">Theme</div>
              <SelectSeparator />
              {THEME_OPTIONS.map((option) => (
                <ThemeSelectItem
                  key={option.value}
                  value={option.value}
                  icon={option.icon}
                >
                  {option.label}
                </ThemeSelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between">
          <small className="text-muted-foreground text-sm">
            Copyright &copy; {currentYear} ReacherX. All rights reserved.
          </small>
          <div className="flex items-center gap-2">
            <Link
              href="#"
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              Privacy policy
            </Link>
            <span className="text-muted-foreground">|</span>
            <Link
              href="#"
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              Terms of service
            </Link>
          </div>
        </div>

        <VecterAILogo className="text-foreground" />
      </div>
    </footer>
  );
}
