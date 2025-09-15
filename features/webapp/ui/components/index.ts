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

export { SidebarSearchHeader } from "./SidebarSearchHeader";
export { SidebarNavigation } from "./SidebarNavigation";
export { SidebarResources } from "./SidebarResources";
export { SidebarKeywords } from "./SidebarKeywords";
export { SidebarFooter } from "./SidebarFooter";
export { SidebarContentWrapper } from "./SidebarContentWrapper";
export { SidebarWrapper } from "./SidebarWrapper";
export { KeywordItemComponent } from "./SidebarKeywordsShared";
export type { KeywordItemComponentProps } from "./SidebarKeywordsShared";

// Page components
export { PageHeader } from "./PageHeader";
export { PageLayout } from "./PageLayout";
export { PageContent } from "./PageContent";
export type { PageHeaderProps } from "./PageHeader";
export type { PageLayoutProps } from "./PageLayout";
export type { PageContentProps } from "./PageContent";
