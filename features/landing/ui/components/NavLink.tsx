// components/NavLink.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils/utils";

export const navLinkVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "text-sm", // Default size
        lg: "text-xl", // Medium size
      },
    },
    defaultVariants: {
      variant: "link",
      size: "sm",
    },
  }
);

interface NavLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof navLinkVariants> {
  href: string;
  children: React.ReactNode;
  activeClassName?: string;
  exact?: boolean;
}

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(
  (
    {
      className,
      variant,
      size,
      href,
      children,
      activeClassName,
      exact = false,
      ...props
    },
    ref
  ) => {
    const pathname = usePathname(); // Returns a string, e.g., "/vision"
    if (!pathname) return null; // Or a fallback
    const isActive =
      pathname === href || (!exact && pathname.startsWith(href + "/"));
    const classNameFinal = cn(
      navLinkVariants({ variant, size }),
      className,
      isActive && activeClassName
    );

    return (
      <Link href={href} className={classNameFinal} ref={ref} {...props}>
        {children}
      </Link>
    );
  }
);

NavLink.displayName = "NavLink";
