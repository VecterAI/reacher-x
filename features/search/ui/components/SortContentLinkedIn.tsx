// features/search/ui/components/SortContentLinkedIn.tsx
"use client";

import { memo, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
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

const schema = z.object({
  sortBy: z.string(),
});

type FormData = z.infer<typeof schema>;

export type LinkedInSortOption =
  | "newest_first"
  | "oldest_first"
  | "most_reacted_first"
  | "least_reacted_first"
  | "most_commented_first"
  | "least_commented_first"
  | "most_reposted_first"
  | "least_reposted_first";

interface Props {
  currentSort: LinkedInSortOption;
  onSortChange: (sort: LinkedInSortOption) => void;
  onReset: () => void;
  onBack?: () => void;
  className?: string;
  isLoading?: boolean;
}

const groups = {
  dateTime: [
    { value: "newest_first" as const, label: "Newest first" },
    { value: "oldest_first" as const, label: "Oldest first" },
  ],
  reactions: [
    {
      value: "most_reacted_first" as const,
      label: "Most reacted first",
      description: "Posts with the most reactions first.",
    },
    {
      value: "least_reacted_first" as const,
      label: "Least reacted first",
      description: "Posts with the least reactions first.",
    },
  ],
  comments: [
    {
      value: "most_commented_first" as const,
      label: "Most commented first",
      description: "Posts with the most comments first.",
    },
    {
      value: "least_commented_first" as const,
      label: "Least commented first",
      description: "Posts with the least comments first.",
    },
  ],
  reposts: [
    {
      value: "most_reposted_first" as const,
      label: "Most reposted first",
      description: "Posts with the most reposts first.",
    },
    {
      value: "least_reposted_first" as const,
      label: "Least reposted first",
      description: "Posts with the least reposts first.",
    },
  ],
} as const;

export const SortContentLinkedIn = memo<Props>(function SortContentLinkedIn({
  currentSort,
  onSortChange,
  onReset,
  onBack,
  className,
  isLoading = false,
}) {
  const form = useForm({
    resolver: zodResolver(schema) as any,
    defaultValues: { sortBy: currentSort } as FormData,
    mode: "onChange",
  });

  const handleSortChange = useCallback(
    (value: string) => {
      onSortChange(value as LinkedInSortOption);
      form.setValue("sortBy", value as LinkedInSortOption);
    },
    [onSortChange, form]
  );

  const handleReset = useCallback(() => {
    form.setValue("sortBy", "newest_first");
    onReset();
  }, [form, onReset]);

  const getSortLabel = useCallback((sort: LinkedInSortOption) => {
    const allOptions = Object.values(groups).flat();
    const option = allOptions.find((opt) => opt.value === sort);
    return option?.label || sort;
  }, []);

  const renderSection = useCallback(
    (
      title: string,
      description: string,
      options: ReadonlyArray<{
        value: LinkedInSortOption;
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
            {form.watch("sortBy") !== "newest_first" && (
              <span className="font-mono text-xs font-medium text-muted-foreground">
                &nbsp;·{" "}
                {getSortLabel(form.watch("sortBy") as LinkedInSortOption)}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleReset}
          disabled={isLoading || form.watch("sortBy") === "newest_first"}
          type="button"
        >
          Reset
        </Button>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1 overscroll-contain pb-4">
        <Form {...form}>
          <div className="space-y-4 py-4">
            {renderSection(
              "Date/Time.",
              "Sort based on date/time.",
              groups.dateTime
            )}
            <Separator />
            {renderSection(
              "Reactions.",
              "Sort based on reactions count.",
              groups.reactions
            )}
            <Separator />
            {renderSection(
              "Comments.",
              "Sort based on comment count.",
              groups.comments
            )}
            <Separator />
            {renderSection(
              "Reposts",
              "Sort based on repost count.",
              groups.reposts
            )}
          </div>
        </Form>
      </ScrollArea>
    </div>
  );
});
