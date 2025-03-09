// components/LinkWrapper.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface LinkWrapperProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  // Elements that should not trigger navigation when clicked
  excludeSelectors?: string[];
}

export const LinkWrapper: React.FC<LinkWrapperProps> = ({
  href,
  children,
  className,
  excludeSelectors = ["button", "a", "video", "[role=button]", "media-chrome"],
}) => {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Get the clicked element
    const target = e.target as HTMLElement;

    // Check if the clicked element or any of its parents match the excluded selectors
    const shouldExclude = excludeSelectors.some((selector) => {
      // Check if the target or any of its parents match the selector
      return target.closest(selector) !== null;
    });

    // Only navigate if we should not exclude this click
    if (!shouldExclude) {
      router.push(href);
    }
  };

  return (
    <div className={className} onClick={handleClick}>
      {children}
    </div>
  );
};
