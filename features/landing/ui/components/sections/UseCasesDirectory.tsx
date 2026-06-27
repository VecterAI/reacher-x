"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { USE_CASES } from "@/features/landing/lib/useCases";
import { UseCaseCard } from "@/features/landing/ui/components/UseCaseCard";
import {
  DEFAULT_WORKSPACE_USE_CASE_GROUP_FILTER,
  WORKSPACE_USE_CASE_GROUPS,
  getWorkspaceUseCaseGroupForUseCaseKey,
  isWorkspaceUseCaseGroupFilterValue,
  type WorkspaceUseCaseGroupFilterValue,
} from "@/shared/lib/workspaceUseCaseGroups";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import { CheckIcon } from "@/shared/ui/components/icons";

function CategorySelectItem({
  value,
  children,
}: {
  value: WorkspaceUseCaseGroupFilterValue;
  children: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="focus:bg-accent focus:text-accent-foreground flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50"
    >
      <SelectPrimitive.ItemText className="flex-1">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ml-auto">
        <CheckIcon className="size-3.5 shrink-0 fill-current" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function UseCasesDirectory() {
  const [selectedGroup, setSelectedGroup] =
    React.useState<WorkspaceUseCaseGroupFilterValue>(
      DEFAULT_WORKSPACE_USE_CASE_GROUP_FILTER
    );

  const visibleUseCases =
    selectedGroup === DEFAULT_WORKSPACE_USE_CASE_GROUP_FILTER
      ? USE_CASES
      : USE_CASES.filter((useCase) => {
          const group = getWorkspaceUseCaseGroupForUseCaseKey(
            useCase.useCaseKey
          );
          return group?.key === selectedGroup;
        });

  return (
    <div className="mx-auto w-full max-w-[1288px] px-4 py-16 md:py-24">
      <header className="mb-8 flex flex-col items-center text-center md:mb-10">
        <h1 className="font-pixel-square text-5xl font-bold tracking-tight md:text-6xl">
          One Agent that adapts to your use cases.
        </h1>
        <p className="mt-4 max-w-3xl text-base md:text-lg">
          Customers, candidates, investors, partners, creators, community
          members, podcast guests, and more.
        </p>

        <div className="mt-10 md:mt-12">
          <Select
            value={selectedGroup}
            onValueChange={(value) => {
              if (!isWorkspaceUseCaseGroupFilterValue(value)) return;
              setSelectedGroup(value);
            }}
          >
            <SelectTrigger
              aria-label="Filter use cases by category"
              size="xs"
              className="w-auto shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-sm font-medium">
                Browse by category
              </div>
              <SelectSeparator />
              <CategorySelectItem
                value={DEFAULT_WORKSPACE_USE_CASE_GROUP_FILTER}
              >
                All
              </CategorySelectItem>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-muted-foreground pl-2 text-xs font-normal">
                  Categories
                </SelectLabel>
                {WORKSPACE_USE_CASE_GROUPS.map((group) => (
                  <CategorySelectItem key={group.key} value={group.key}>
                    {group.categoryLabel}
                  </CategorySelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {visibleUseCases.map((useCase) => (
          <UseCaseCard key={useCase.slug} useCase={useCase} />
        ))}
      </div>
    </div>
  );
}
