/**
 * Barrel exports for webapp UI components
 *
 * This file serves as a single entry point for importing webapp components,
 * following the Module Pattern for better organization.
 *
 * References:
 * - Barrel Exports: https://basarat.gitbook.io/typescript/main-1/barrel
 * - Module Pattern: https://www.patterns.dev/posts/module-pattern
 */

// ============================================================================
// Sidebar components
// ============================================================================
export {
  SidebarWrapper,
  SidebarContentWrapper,
  SidebarSearchHeader,
  SidebarNavigation,
  SidebarResources,
  SidebarFooter,
} from "./sidebar";

// ============================================================================
// Page layout components
// ============================================================================
export {
  PageLayout,
  PageHeader,
  PageContent,
} from "./page";
export type {
  PageLayoutProps,
  PageHeaderProps,
  PageContentProps,
} from "./page";

// ============================================================================
// Tweet/X post components
// ============================================================================
export {
  Tweet,
  TweetHeader,
  TweetBody,
  TweetFooter,
  TweetMenu,
  QuoteTweetCard,
} from "./tweet";
export type {
  TweetProps,
  TweetBodyProps,
  QuoteTweetCardProps,
} from "./tweet";

// ============================================================================
// LinkedIn post components
// ============================================================================
export {
  LinkedInPostCard,
  LinkedInPostCardSkeleton,
  LinkedInHeader,
  LinkedInBody,
  LinkedInFooter,
  LinkedInMenu,
  LinkedInMediaGrid,
  LinkedInGalleryViewer,
  QuoteLinkedInCard,
  QuoteLinkedInCardSkeleton,
} from "./linkedin";
export type {
  LinkedInPostCardProps,
  LinkedInHeaderProps,
  LinkedInBodyProps,
  LinkedInFooterProps,
  LinkedInMenuProps,
  LinkedInMediaGridProps,
  QuoteLinkedInCardProps,
} from "./linkedin";

// ============================================================================
// Root-level components (unique/provider components)
// ============================================================================
export { Header } from "./Header";
export { NotificationProvider } from "./NotificationProvider";
