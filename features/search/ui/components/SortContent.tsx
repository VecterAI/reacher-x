// features/search/ui/components/SortContent.tsx
"use client";

import { memo, useCallback } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/ui/components/Button";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Separator } from "@/shared/ui/components/Separator";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/components/RadioGroup";
import { ArrowBackIcon } from "@/shared/ui/components/icons";
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
} from "@/shared/ui/components/Form";
import { cn } from "@/shared/lib/utils/utils";
import {
  sortSchema,
  type SortOption,
  type SortFormData,
} from "../../lib/schemas";

// Context removed - component now works with props only

interface SortContentProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  onReset: () => void;
  onBack?: () => void;
  className?: string;
  isLoading?: boolean;
}

// Sort option groups with metadata
const sortOptions = {
  dateTime: [
    { value: "newest_first" as const, label: "Newest first" },
    { value: "oldest_first" as const, label: "Oldest first" },
  ],
  impressions: [
    {
      value: "most_viewed_first" as const,
      label: "Most viewed first",
      description: "Posts with the most impressions first.",
    },
    {
      value: "least_viewed_first" as const,
      label: "Least viewed first",
      description: "Posts with the least impressions first.",
    },
  ],
  likes: [
    {
      value: "most_liked_first" as const,
      label: "Most liked first",
      description: "Posts with the most likes first.",
    },
    {
      value: "least_liked_first" as const,
      label: "Least liked first",
      description: "Posts with the least likes first.",
    },
  ],
  replies: [
    {
      value: "most_replied_first" as const,
      label: "Most replied first",
      description: "Posts with the most replies first.",
    },
    {
      value: "least_replied_first" as const,
      label: "Least replied first",
      description: "Posts with the least replies first.",
    },
  ],
  retweets: [
    {
      value: "most_retweeted_first" as const,
      label: "Most retweeted first",
      description: "Posts with the most retweets first.",
    },
    {
      value: "least_retweeted_first" as const,
      label: "Least retweets first",
      description: "Posts with the least retweets first.",
    },
  ],
  quotes: [
    {
      value: "most_quoted_first" as const,
      label: "Most quoted first",
      description: "Posts with the most quotes first.",
    },
    {
      value: "least_quoted_first" as const,
      label: "Least quoted first",
      description: "Posts with the least quotes first.",
    },
  ],
  bookmarks: [
    {
      value: "most_bookmarked_first" as const,
      label: "Most bookmarked first",
      description: "Posts with the most bookmarks first.",
    },
    {
      value: "least_bookmarked_first" as const,
      label: "Least bookmarked first",
      description: "Posts with the least bookmarks first.",
    },
  ],
  verification: [
    {
      value: "verified_first" as const,
      label: "Verified first",
      description: "People with verification badge first.",
    },
    {
      value: "unverified_first" as const,
      label: "Unverified first",
      description: "People without badge first.",
    },
  ],
} as const;

export const SortContent = memo<SortContentProps>(function SortContent({
  currentSort,
  onSortChange,
  onReset,
  onBack,
  className,
  isLoading = false,
}) {
  // Context removed - component now works with props only
  // Track if sort is modified by comparing currentSort with default
  const isModified = currentSort !== "newest_first";

  const form = useForm<SortFormData>({
    resolver: zodResolver(sortSchema) as unknown as Resolver<SortFormData>,
    defaultValues: { sortBy: currentSort },
    mode: "onChange",
  });

  // Handle sort change - immediate application
  const handleSortChange = useCallback(
    (value: string) => {
      const sortOption = value as SortOption;
      form.setValue("sortBy", sortOption);
      onSortChange(sortOption);
    },
    [form, onSortChange]
  );

  const handleReset = useCallback(() => {
    form.setValue("sortBy", "newest_first");
    onReset();
  }, [form, onReset]);

  // Get the label for the current sort option
  const getSortLabel = useCallback((sort: SortOption) => {
    const allOptions = Object.values(sortOptions).flat();
    const option = allOptions.find((opt) => opt.value === sort);
    return option?.label || sort;
  }, []);

  // Render a sort section
  const renderSortSection = useCallback(
    (
      title: string,
      description: string,
      options: ReadonlyArray<{
        value: SortOption;
        label: string;
        description?: string;
      }>
    ) => (
      <div className="space-y-1.5 px-4">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-1.5 text-xs text-muted-foreground">
            ↳ {description}
          </p>
        </div>

        <Controller
          control={form.control}
          name="sortBy"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={handleSortChange}
                  disabled={isLoading}
                  className="gap-0.5"
                >
                  {options.map((option) => (
                    <div key={option.value} className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value={option.value}
                          id={option.value}
                        />
                        <FormLabel
                          htmlFor={option.value}
                          className="text-sm font-medium"
                        >
                          {option.label}
                        </FormLabel>
                      </div>
                      {option.description && (
                        <FormDescription className="ml-6 text-xs">
                          ↳ {option.description}
                        </FormDescription>
                      )}
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    ),
    [form.control, handleSortChange, isLoading]
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col md:border-l md:border-border",
        className
      )}
    >
      {/* Header */}
      <header className="sticky left-0 right-0 top-0 z-20 flex items-center justify-between border-b bg-background py-2 pl-2.5 pr-4">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="xsIcon"
              onClick={onBack}
              aria-label="Go back"
              type="button"
            >
              <ArrowBackIcon className="h-4 w-4 fill-current" />
            </Button>
          )}
          <div className="flex items-center gap-1">
            <h2 className="text-sm font-medium">Sort.</h2>
            {isModified && (
              <span className="font-mono text-xs font-medium text-muted-foreground">
                &nbsp;· {getSortLabel(currentSort)}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleReset}
          disabled={!isModified || isLoading}
          type="button"
        >
          Reset
        </Button>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1 overscroll-contain pb-4">
        <Form {...form}>
          <div className="space-y-4 py-4">
            {/* Date/Time Section */}
            {renderSortSection(
              "Date/Time.",
              "Sort based on date/time.",
              sortOptions.dateTime
            )}

            <Separator />

            {/* Impressions Section */}
            {renderSortSection(
              "Impressions.",
              "Sort based on impression count.",
              sortOptions.impressions
            )}

            <Separator />

            {/* Likes Section */}
            {renderSortSection(
              "Likes.",
              "Sort based on like count.",
              sortOptions.likes
            )}

            <Separator />

            {/* Replies Section */}
            {renderSortSection(
              "Replies.",
              "Sort based on reply count.",
              sortOptions.replies
            )}

            <Separator />

            {/* Retweets Section */}
            {renderSortSection(
              "Retweets",
              "Sort based on retweet count.",
              sortOptions.retweets
            )}

            <Separator />

            {/* Quotes Section */}
            {renderSortSection(
              "Quotes",
              "Sort based on quote count.",
              sortOptions.quotes
            )}

            <Separator />

            {/* Bookmarks Section */}
            {renderSortSection(
              "Bookmarks",
              "Sort based on bookmark count.",
              sortOptions.bookmarks
            )}

            <Separator />

            {/* Verification Section */}
            {renderSortSection(
              "Verification.",
              "Sort based on verification status.",
              sortOptions.verification
            )}
          </div>
        </Form>
      </ScrollArea>
    </div>
  );
});
