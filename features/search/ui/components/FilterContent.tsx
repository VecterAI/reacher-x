"use client";

import { memo, useEffect, useRef, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/ui/components/Button";
import { Input } from "@/shared/ui/components/Input";
import { Checkbox } from "@/shared/ui/components/Checkbox";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Separator } from "@/shared/ui/components/Separator";
import { ArrowBackIcon } from "@/shared/ui/components/icons";
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/Form";
import { cn } from "@/shared/lib/utils/utils";
import { filterSchema, type FilterFormData } from "../../lib/schemas";
import { filterStateToFormData, formDataToFilterState } from "../../lib/utils";
import type { FilterState } from "../../types";

interface FilterContentProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onApply: () => void;
  onReset: () => void;
  onBack?: () => void;
  className?: string;
  isLoading?: boolean;
}

export const FilterContent = memo<FilterContentProps>(function FilterContent({
  filters,
  onFiltersChange,
  onApply,
  onReset,
  onBack,
  className,
  isLoading = false,
}) {
  // Refs to prevent infinite loops
  const isExternalUpdateRef = useRef(false);
  const lastFiltersRef = useRef<FilterState>(filters);

  const form = useForm({
    resolver: zodResolver(filterSchema),
    defaultValues: filterStateToFormData(filters),
    mode: "onChange", // Enable real-time validation
  });

  // Watch form values - this creates a new object reference on each change
  const watchedValues = form.watch();

  // Deep comparison utility to avoid unnecessary updates
  const areFiltersEqual = useCallback(
    (a: FilterState, b: FilterState): boolean => {
      return JSON.stringify(a) === JSON.stringify(b);
    },
    []
  );

  // Memoized filter state conversion to avoid unnecessary recalculations
  const currentFilterState = useCallback(() => {
    return formDataToFilterState(watchedValues);
  }, [watchedValues]);

  // Sync form changes to parent state (only for user-initiated changes)
  useEffect(() => {
    // Skip if this is an external update (from props)
    if (isExternalUpdateRef.current) {
      return;
    }

    const newFilterState = currentFilterState();

    // Only update if filters actually changed (deep comparison)
    if (!areFiltersEqual(newFilterState, lastFiltersRef.current)) {
      lastFiltersRef.current = newFilterState;
      onFiltersChange(newFilterState);
    }
  }, [watchedValues, onFiltersChange, currentFilterState, areFiltersEqual]);

  // Sync external filters to form (only when props actually change)
  useEffect(() => {
    // Only update if external filters are different from what we have
    if (!areFiltersEqual(filters, lastFiltersRef.current)) {
      isExternalUpdateRef.current = true;
      lastFiltersRef.current = filters;

      const formData = filterStateToFormData(filters);
      form.reset(formData, {
        keepErrors: false,
        keepDirty: false,
        keepIsSubmitted: false,
        keepTouched: false,
        keepIsValid: false,
        keepSubmitCount: false,
      });

      // Reset the flag after React has processed the update
      queueMicrotask(() => {
        isExternalUpdateRef.current = false;
      });
    }
  }, [filters, form, areFiltersEqual]);

  const handleSubmit = useCallback(
    (data: FilterFormData) => {
      console.log("Form submitted with data:", data);
      onApply();
    },
    [onApply]
  );

  const handleReset = useCallback(() => {
    isExternalUpdateRef.current = true;
    const emptyState: FilterState = {};
    const emptyFormData = filterStateToFormData(emptyState);

    lastFiltersRef.current = emptyState;
    form.reset(emptyFormData, {
      keepErrors: false,
      keepDirty: false,
      keepIsSubmitted: false,
      keepTouched: false,
      keepIsValid: false,
      keepSubmitCount: false,
    });

    queueMicrotask(() => {
      isExternalUpdateRef.current = false;
    });

    onReset();
  }, [form, onReset]);

  // Check if there are active filters (memoized for performance)
  const hasActiveFilters = useCallback(() => {
    return Object.values(watchedValues).some((value) =>
      typeof value === "boolean" ? value : Boolean(value?.trim())
    );
  }, [watchedValues]);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <header className="sticky left-0 right-0 top-12 z-20 flex items-center justify-between border-b bg-main py-2 pl-2.5 pr-4">
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
          <h2 className="text-sm font-medium">Filter.</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleReset}
            disabled={!hasActiveFilters() || isLoading}
            type="button"
          >
            Reset
          </Button>
          <Button
            size="xs"
            type="submit"
            form="filter-form"
            disabled={isLoading}
          >
            Apply
          </Button>
        </div>
      </header>

      {/* Form Content */}
      <ScrollArea className="flex-1">
        <Form {...form}>
          <form
            id="filter-form"
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
            noValidate
          >
            {/* Verification Section */}
            <div className="space-y-4 px-4 pt-4">
              <div>
                <h3 className="text-sm font-medium">Verification.</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  ↳ Filter based on verification status.
                </p>
              </div>

              <div className="space-y-0.5">
                <Controller
                  control={form.control}
                  name="verified"
                  render={({ field, fieldState }) => (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <div className="grid gap-1.5 leading-none">
                        <FormLabel className="text-sm font-normal">
                          Verified
                        </FormLabel>
                        <FormDescription className="text-xs">
                          ↳ Potential customer with a verification badge.
                        </FormDescription>
                      </div>
                      {fieldState.error && (
                        <FormMessage>{fieldState.error.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />

                <Controller
                  control={form.control}
                  name="unverified"
                  render={({ field, fieldState }) => (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <div className="grid gap-1.5 leading-none">
                        <FormLabel className="text-sm font-normal">
                          Unverified
                        </FormLabel>
                        <FormDescription className="text-xs">
                          ↳ Potential customer without a verification badge.
                        </FormDescription>
                      </div>
                      {fieldState.error && (
                        <FormMessage>{fieldState.error.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <section className="space-y-4 px-4 pb-4">
              {/* Responsive Grid Container for Form Fields */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* From Section */}
                <Controller
                  control={form.control}
                  name="from"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        From
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., elonmusk"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="ml-3 text-xs text-muted-foreground">
                        ↳ Posts from a specific @username.
                      </FormDescription>
                      {fieldState.error && (
                        <FormMessage>{fieldState.error.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />

                {/* To Section */}
                <Controller
                  control={form.control}
                  name="to"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">To</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., elonmusk"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="ml-3 text-xs text-muted-foreground">
                        ↳ Posts replying to a specific @username.
                      </FormDescription>
                      {fieldState.error && (
                        <FormMessage>{fieldState.error.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />

                {/* Mention Section */}
                <Controller
                  control={form.control}
                  name="mention"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Mention
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., elonmusk"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="ml-3 text-xs text-muted-foreground">
                        ↳ Posts mentioning a specific @username.
                      </FormDescription>
                      {fieldState.error && (
                        <FormMessage>{fieldState.error.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />

                {/* List Section */}
                <Controller
                  control={form.control}
                  name="list"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        List
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., esa/astronauts"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="ml-3 text-xs text-muted-foreground">
                        ↳ Posts from members of a specified public list (by list
                        ID or slug).
                      </FormDescription>
                      {fieldState.error && (
                        <FormMessage>{fieldState.error.message}</FormMessage>
                      )}
                    </FormItem>
                  )}
                />
              </div>
            </section>
          </form>
        </Form>
      </ScrollArea>
    </div>
  );
});
