"use client";
/**
 * SidebarContentWrapper Component
 *
 * Manages the dynamic content area of the sidebar.
 *
 * References:
 * - Conditional Rendering: https://react.dev/learn/conditional-rendering
 * - Children Prop Pattern: https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children
 */

import { ReactNode } from "react";
import { SidebarContent } from "@/shared/ui/components/Sidebar";

interface SidebarContentWrapperProps {
  children: ReactNode;
}

export function SidebarContentWrapper({
  children,
}: SidebarContentWrapperProps) {
  return <SidebarContent>{children}</SidebarContent>;
}

