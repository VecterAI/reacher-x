"use client";

import { memo, useEffect, useRef, useCallback } from "react";
import { useForm, Controller, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/ui/components/Button";
import { Input } from "@/shared/ui/components/Input";
import { Checkbox } from "@/shared/ui/components/Checkbox";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { Separator } from "@/shared/ui/components/Separator";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/components/RadioGroup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/Select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/components/Tabs";
import { DateRangePicker } from "@/shared/ui/components/DateRangePicker";
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
import {
  filterStateToFormData,
  formDataToFilterState,
  getDefaultFilterState,
} from "../../lib/utils";
import { useFilter } from "../../contexts/FilterContext";
import type { FilterState } from "../../types";
import { SUPPORTED_LANGUAGES } from "../../lib/filterUtils";

interface FilterContentProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onApply: () => void;
  onReset: () => void;
  onBack?: () => void;
  className?: string;
  isLoading?: boolean;
}

// SOLVED: Define typed arrays for mapped controllers to ensure type safety.
const videoOptions: { name: Path<FilterFormData>; label: string }[] = [
  { name: "periscope", label: "↳ Periscope" },
  { name: "nativeVideo", label: "↳ Native video" },
  { name: "consumerVideo", label: "↳ Consumer video" },
  { name: "proVideo", label: "↳ Pro video" },
  { name: "vine", label: "↳ Vine" },
];

const contentFilterOptions: { name: Path<FilterFormData>; label: string }[] = [
  { name: "mentions", label: "Mentions" },
  { name: "news", label: "News" },
  { name: "hashtags", label: "Hashtags" },
];

export const FilterContent = memo<FilterContentProps>(function FilterContent({
  filters,
  onFiltersChange,
  onApply,
  onReset,
  onBack,
  className,
  isLoading = false,
}) {
  const isExternalUpdateRef = useRef(false);
  const lastFiltersRef = useRef<FilterState>(filters);

  // Get filter state from context
  const {
    hasActiveFilters,
    firstActiveFilter,
    canApplyChanges,
    updateFormDirtyState,
    unimplementedFilters,
  } = useFilter();

  const form = useForm({
    resolver: zodResolver(filterSchema),
    defaultValues: filterStateToFormData(filters),
    mode: "onChange",
  });

  const watchedValues = form.watch();
  const { isDirty } = form.formState; // NEW: Track if form has been touched by user

  // NEW: Sync form's dirty state with context
  useEffect(() => {
    updateFormDirtyState(isDirty);
  }, [isDirty, updateFormDirtyState]);

  const areFiltersEqual = useCallback(
    (a: FilterState, b: FilterState): boolean => {
      return JSON.stringify(a) === JSON.stringify(b);
    },
    []
  );

  const currentFilterState = useCallback(() => {
    return formDataToFilterState(watchedValues);
  }, [watchedValues]);

  // Sync form changes to parent state
  useEffect(() => {
    if (isExternalUpdateRef.current) {
      return;
    }

    const newFilterState = currentFilterState();

    if (!areFiltersEqual(newFilterState, lastFiltersRef.current)) {
      lastFiltersRef.current = newFilterState;
      onFiltersChange(newFilterState);
    }
  }, [watchedValues, onFiltersChange, currentFilterState, areFiltersEqual]);

  // Sync external filters to form
  useEffect(() => {
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
    const defaultState = getDefaultFilterState();
    const defaultFormData = filterStateToFormData(defaultState);

    lastFiltersRef.current = defaultState;
    form.reset(defaultFormData, {
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

  // Watch specific values for conditional rendering
  const dateRange = form.watch("dateRange");
  const mediaPresence = form.watch("mediaPresence");
  const videos = form.watch("videos");
  const engagement = form.watch("engagement");

  // Handle video checkbox dependencies
  const handleVideosChange = useCallback(
    (checked: boolean) => {
      form.setValue("videos", checked, { shouldDirty: true });
      if (checked) {
        // Auto-select all video types when videos is checked
        form.setValue("periscope", true, { shouldDirty: true });
        form.setValue("nativeVideo", true, { shouldDirty: true });
        form.setValue("consumerVideo", true, { shouldDirty: true });
        form.setValue("proVideo", true, { shouldDirty: true });
        form.setValue("vine", true, { shouldDirty: true });
      }
    },
    [form]
  );

  // Handle media presence change
  const handleMediaPresenceChange = useCallback(
    (value: string) => {
      // SOLVED: Cast the value to the specific type expected by the 'mediaPresence' field.
      // This is a safe downcast because the RadioGroup only provides values defined in the schema.
      form.setValue("mediaPresence", value as FilterFormData["mediaPresence"], {
        shouldDirty: true,
      });
      if (value === "any" || value === "with_media") {
        // Auto-select all media types and content filters
        form.setValue("images", true, { shouldDirty: true });
        form.setValue("twitterImages", true, { shouldDirty: true });
        form.setValue("videos", true, { shouldDirty: true });
        form.setValue("periscope", true, { shouldDirty: true });
        form.setValue("nativeVideo", true, { shouldDirty: true });
        form.setValue("consumerVideo", true, { shouldDirty: true });
        form.setValue("proVideo", true, { shouldDirty: true });
        form.setValue("vine", true, { shouldDirty: true });
        form.setValue("spaces", true, { shouldDirty: true });
        form.setValue("links", true, { shouldDirty: true });
        form.setValue("mentions", true, { shouldDirty: true });
        form.setValue("news", true, { shouldDirty: true });
        form.setValue("hashtags", true, { shouldDirty: true });
        form.setValue("hideSensitiveContent", true, { shouldDirty: true });
      }
    },
    [form]
  );

  return (
    <div
      className={cn(
        "flex h-full flex-col md:border-l md:border-border",
        className
      )}
    >
      {/* Header */}
      <header className="sticky left-0 right-0 top-12 z-20 flex items-center justify-between border-b bg-background py-2 pl-2.5 pr-4">
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
            <h2 className="text-sm font-medium">Filter.</h2>
            {firstActiveFilter && (
              <span className="font-mono text-xs font-medium text-muted-foreground">
                &nbsp;· {firstActiveFilter.name}
                {firstActiveFilter.count > 0 && `, +${firstActiveFilter.count}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleReset}
            disabled={!hasActiveFilters || isLoading}
            type="button"
          >
            Reset
          </Button>
          <Button
            size="xs"
            type="submit"
            form="filter-form"
            disabled={!canApplyChanges || isLoading}
          >
            Apply
          </Button>
        </div>
      </header>

      {/* Unimplemented Filters Warning */}
      {unimplementedFilters.length > 0 && (
        <div className="border-b bg-yellow-50 px-4 py-3 dark:bg-yellow-950/20">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-4 w-4 rounded-full bg-yellow-500" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Some filters are not implemented
              </h4>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                The following filters cannot be applied on the client-side and
                will be ignored:
              </p>
              <ul className="mt-2 space-y-1">
                {unimplementedFilters.map((filter, index) => (
                  <li
                    key={index}
                    className="text-xs text-yellow-600 dark:text-yellow-400"
                  >
                    • {filter}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <Tabs defaultValue="users">
        <div className="relative my-4">
          {/* Gradient overlays (no changes here) */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-gradient-to-r from-background to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-gradient-to-l from-background to-transparent"
            aria-hidden="true"
          />

          {/* 
    The inner div is the scroll container.
    Add the new classes here to hide the scrollbar.
  */}
          <div className="scrollbar-none overflow-x-scroll px-4 [&::-webkit-scrollbar]:hidden">
            <TabsList size="sm">
              <TabsTrigger value="users" size="sm">
                Users
              </TabsTrigger>
              <TabsTrigger value="date" size="sm">
                Date
              </TabsTrigger>
              <TabsTrigger value="content" size="sm">
                Content
              </TabsTrigger>
              <TabsTrigger value="media" size="sm">
                Media
              </TabsTrigger>
              <TabsTrigger value="engagement" size="sm">
                Engagement
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Form Content */}
        <ScrollArea className="flex-1">
          <Form {...form}>
            <form
              id="filter-form"
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
              noValidate
            >
              {/* Users Tab */}
              <TabsContent value="users" className="mt-0">
                <div className="space-y-4">
                  {/* Verification Section */}
                  <div className="space-y-1.5 px-4">
                    <div>
                      <h3 className="text-sm font-medium">Verification.</h3>
                      <p className="mt-1.5 text-xs text-muted-foreground">
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
                            <div className="grid gap-0.5">
                              <FormLabel className="text-sm font-medium">
                                Verified
                              </FormLabel>
                              <FormDescription className="text-xs">
                                ↳ Potential customer with a verification badge.
                              </FormDescription>
                            </div>
                            {fieldState.error && (
                              <FormMessage>
                                {fieldState.error.message}
                              </FormMessage>
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
                            <div className="grid gap-0.5">
                              <FormLabel className="text-sm font-medium">
                                Unverified
                              </FormLabel>
                              <FormDescription className="text-xs">
                                ↳ Potential customer without a verification
                                badge.
                              </FormDescription>
                            </div>
                            {fieldState.error && (
                              <FormMessage>
                                {fieldState.error.message}
                              </FormMessage>
                            )}
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* User Fields */}
                  <section className="space-y-4 px-4 @container">
                    <div className="grid grid-cols-1 gap-x-2 gap-y-4 @sm:grid-cols-2 @md:grid-cols-3 @lg:grid-cols-4">
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
                                size="sm"
                                placeholder="e.g., elonmusk"
                                disabled={isLoading}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="ml-3 text-xs text-muted-foreground">
                              ↳ Posts from a specific @username.
                            </FormDescription>
                            {fieldState.error && (
                              <FormMessage>
                                {fieldState.error.message}
                              </FormMessage>
                            )}
                          </FormItem>
                        )}
                      />

                      <Controller
                        control={form.control}
                        name="to"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">
                              To
                            </FormLabel>
                            <FormControl>
                              <Input
                                size="sm"
                                placeholder="e.g., elonmusk"
                                disabled={isLoading}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="ml-3 text-xs text-muted-foreground">
                              ↳ Posts replying to a specific @username.
                            </FormDescription>
                            {fieldState.error && (
                              <FormMessage>
                                {fieldState.error.message}
                              </FormMessage>
                            )}
                          </FormItem>
                        )}
                      />

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
                                size="sm"
                                placeholder="e.g., elonmusk"
                                disabled={isLoading}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="ml-3 text-xs text-muted-foreground">
                              ↳ Posts mentioning a specific @username.
                            </FormDescription>
                            {fieldState.error && (
                              <FormMessage>
                                {fieldState.error.message}
                              </FormMessage>
                            )}
                          </FormItem>
                        )}
                      />

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
                                size="sm"
                                placeholder="e.g., esa/astronauts"
                                disabled={isLoading}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="ml-3 text-xs text-muted-foreground">
                              ↳ Posts from members of a specified public list
                              (by list ID or slug).
                            </FormDescription>
                            {fieldState.error && (
                              <FormMessage>
                                {fieldState.error.message}
                              </FormMessage>
                            )}
                          </FormItem>
                        )}
                      />
                    </div>
                  </section>
                </div>
              </TabsContent>

              {/* Date Tab */}
              <TabsContent value="date" className="mt-0">
                <div className="space-y-4">
                  {/* No Range Section */}
                  <div className="space-y-1.5 px-4">
                    <div>
                      <h3 className="text-sm font-medium">No range.</h3>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        ↳ See all posts without any date filter.
                      </p>
                    </div>

                    <Controller
                      control={form.control}
                      name="dateRange"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start gap-3 space-y-0">
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={isLoading}
                            >
                              <div className="flex items-start space-x-2">
                                <RadioGroupItem
                                  value="all_time"
                                  id="all_time"
                                />
                                <div className="grid gap-0.5">
                                  <FormLabel
                                    htmlFor="all_time"
                                    className="text-sm font-medium"
                                  >
                                    All time
                                  </FormLabel>
                                  <FormDescription className="text-xs">
                                    ↳ See posts from any time period.
                                  </FormDescription>
                                </div>
                              </div>
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* Filter by Range Section */}
                  <div className="space-y-1.5 px-4">
                    <div>
                      <h3 className="text-sm font-medium">Filter by range.</h3>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        ↳ See posts from any time period.
                      </p>
                    </div>

                    <Controller
                      control={form.control}
                      name="dateRange"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={isLoading}
                              className="gap-0.5"
                            >
                              {[
                                {
                                  value: "last_1_hour",
                                  label: "Last 1 hour",
                                },
                                {
                                  value: "last_24_hours",
                                  label: "Last 24 hours",
                                },
                                { value: "last_7_days", label: "Last 7 days" },
                                {
                                  value: "last_30_days",
                                  label: "Last 30 days",
                                },
                                {
                                  value: "last_365_days",
                                  label: "Last 365 days",
                                },
                              ].map((option) => (
                                <div
                                  key={option.value}
                                  className="flex items-center space-x-2"
                                >
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
                              ))}

                              {/* Last X Option */}
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="last_x" id="last_x" />
                                <FormLabel
                                  htmlFor="last_x"
                                  className="text-sm font-medium"
                                >
                                  Last X
                                </FormLabel>
                              </div>

                              {/* Last X Inputs */}
                              {dateRange === "last_x" && (
                                <div className="ml-6 flex gap-2">
                                  <Controller
                                    control={form.control}
                                    name="lastXValue"
                                    render={({ field }) => (
                                      <Input
                                        size="sm"
                                        placeholder="e.g., 60"
                                        disabled={isLoading}
                                        {...field}
                                      />
                                    )}
                                  />
                                  <Controller
                                    control={form.control}
                                    name="lastXUnit"
                                    render={({ field }) => (
                                      <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        disabled={isLoading}
                                      >
                                        <SelectTrigger size="sm">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="minutes">
                                            minutes
                                          </SelectItem>
                                          <SelectItem value="hours">
                                            hours
                                          </SelectItem>
                                          <SelectItem value="days">
                                            days
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )}
                                  />
                                </div>
                              )}

                              {/* Custom Range Option */}
                              <div className="flex items-start space-x-2">
                                <RadioGroupItem
                                  value="custom_range"
                                  id="custom_range"
                                />
                                <div className="grid gap-0.5">
                                  <FormLabel
                                    htmlFor="custom_range"
                                    className="text-sm font-medium"
                                  >
                                    Custom range
                                  </FormLabel>
                                  <FormDescription className="text-xs">
                                    ↳ Select your own date range.
                                  </FormDescription>
                                </div>
                              </div>

                              {/* Custom Range Picker */}
                              {dateRange === "custom_range" && (
                                <div className="ml-6">
                                  <Controller
                                    control={form.control}
                                    name="customRangeStart"
                                    render={({ field }) => (
                                      <DateRangePicker
                                        value={{
                                          from: field.value,
                                          to: form.watch("customRangeEnd"),
                                        }}
                                        onChange={(range) => {
                                          form.setValue(
                                            "customRangeStart",
                                            range?.from
                                          );
                                          form.setValue(
                                            "customRangeEnd",
                                            range?.to
                                          );
                                        }}
                                        disabled={isLoading}
                                      />
                                    )}
                                  />
                                </div>
                              )}
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Content Tab */}
              <TabsContent value="content" className="mt-0">
                <div className="space-y-4 px-4">
                  <Controller
                    control={form.control}
                    name="url"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Url
                        </FormLabel>
                        <FormControl>
                          <Input
                            size="sm"
                            placeholder="e.g., gu.com or theguardian.com"
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

                  <Controller
                    control={form.control}
                    name="language"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Language
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isLoading}
                          >
                            <SelectTrigger size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SUPPORTED_LANGUAGES.map((lang) => (
                                <SelectItem key={lang.code} value={lang.code}>
                                  {lang.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormDescription className="ml-3 text-xs text-muted-foreground">
                          ↳ Search for tweets in specified language, not always
                          accurate
                        </FormDescription>
                        {fieldState.error && (
                          <FormMessage>{fieldState.error.message}</FormMessage>
                        )}
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Media Tab */}
              <TabsContent value="media" className="mt-0">
                <div className="space-y-4">
                  {/* Media Presence */}
                  <div className="space-y-1.5 px-4">
                    <div>
                      <h3 className="text-sm font-medium">Media presence.</h3>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        ↳ Show posts based on whether they include any media.
                      </p>
                    </div>

                    <Controller
                      control={form.control}
                      name="mediaPresence"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={handleMediaPresenceChange}
                              disabled={isLoading}
                              className="gap-0.5"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="any" id="media_any" />
                                <FormLabel
                                  htmlFor="media_any"
                                  className="text-sm font-medium"
                                >
                                  Any
                                </FormLabel>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem
                                  value="with_media"
                                  id="with_media"
                                />
                                <FormLabel
                                  htmlFor="with_media"
                                  className="text-sm font-medium"
                                >
                                  With media
                                </FormLabel>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem
                                  value="without_media"
                                  id="without_media"
                                />
                                <FormLabel
                                  htmlFor="without_media"
                                  className="text-sm font-medium"
                                >
                                  Without media
                                </FormLabel>
                              </div>
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Media Types - Only show when Any or With media is selected */}
                  {(mediaPresence === "any" ||
                    mediaPresence === "with_media") && (
                    <>
                      <Separator />

                      <div className="space-y-1.5 px-4">
                        <div>
                          <h3 className="text-sm font-medium">Media types.</h3>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            ↳ Pick the kinds of media to include.
                          </p>
                        </div>

                        <div className="gap-0.5">
                          <Controller
                            control={form.control}
                            name="images"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start gap-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={isLoading}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-medium">
                                  Images
                                </FormLabel>
                              </FormItem>
                            )}
                          />

                          <Controller
                            control={form.control}
                            name="twitterImages"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start gap-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={isLoading}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-medium">
                                  Twitter images (twimg)
                                </FormLabel>
                              </FormItem>
                            )}
                          />

                          <Controller
                            control={form.control}
                            name="videos"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start gap-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={handleVideosChange}
                                    disabled={isLoading}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-medium">
                                  Videos
                                </FormLabel>
                              </FormItem>
                            )}
                          />

                          {/* Video sub-options */}
                          {videos && (
                            <div className="ml-6 gap-0.5">
                              {/* SOLVED: Map over the typed array. No `as any` is needed. */}
                              {videoOptions.map((option) => (
                                <Controller
                                  key={option.name}
                                  control={form.control}
                                  name={option.name}
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-start gap-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value as boolean}
                                          onCheckedChange={field.onChange}
                                          disabled={isLoading}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-medium">
                                        {option.label}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          )}

                          <Controller
                            control={form.control}
                            name="spaces"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start gap-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={isLoading}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-medium">
                                  Spaces
                                </FormLabel>
                              </FormItem>
                            )}
                          />

                          <Controller
                            control={form.control}
                            name="links"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start gap-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={isLoading}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-medium">
                                  Links
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Content Filters */}
                      <div className="space-y-1.5 px-4">
                        <div>
                          <h3 className="text-sm font-medium">
                            Content filters.
                          </h3>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            ↳ Only show posts containing:
                          </p>
                        </div>

                        <div className="gap-0.5">
                          {/* SOLVED: Map over the typed array. No `as any` is needed. */}
                          {contentFilterOptions.map((option) => (
                            <Controller
                              key={option.name}
                              control={form.control}
                              name={option.name}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start gap-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value as boolean}
                                      onCheckedChange={field.onChange}
                                      disabled={isLoading}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-medium">
                                    {option.label}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Sensitive Content */}
                      <div className="space-y-1.5 px-4">
                        <div>
                          <h3 className="text-sm font-medium">
                            Sensitive content.
                          </h3>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            ↳ Exclude posts marked as potentially sensitive.
                          </p>
                        </div>

                        <Controller
                          control={form.control}
                          name="hideSensitiveContent"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start gap-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={isLoading}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-medium">
                                Hide sensitive content
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              {/* Engagement Tab */}
              <TabsContent value="engagement" className="mt-0">
                <div className="space-y-4">
                  {/* Engagement */}
                  <div className="space-y-1.5 px-4">
                    <div>
                      <h3 className="text-sm font-medium">Engagement.</h3>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        ↳ See posts from any time period.
                      </p>
                    </div>

                    <Controller
                      control={form.control}
                      name="engagement"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={isLoading}
                              className="gap-0.5"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem
                                  value="any"
                                  id="engagement_any"
                                />
                                <FormLabel
                                  htmlFor="engagement_any"
                                  className="text-sm font-medium"
                                >
                                  Any
                                </FormLabel>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem
                                    value="with_engagement"
                                    id="with_engagement"
                                  />
                                  <FormLabel
                                    htmlFor="with_engagement"
                                    className="text-sm font-medium"
                                  >
                                    With engagement
                                  </FormLabel>
                                </div>
                                <FormDescription className="ml-6 text-xs">
                                  ↳ Posts with ≥ 1 like or retweet or reply.
                                </FormDescription>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem
                                    value="without_engagement"
                                    id="without_engagement"
                                  />
                                  <FormLabel
                                    htmlFor="without_engagement"
                                    className="text-sm font-medium"
                                  >
                                    Without engagement
                                  </FormLabel>
                                </div>
                                <FormDescription className="ml-6 text-xs">
                                  ↳ Posts with 0 likes, 0 retweets, 0 replies.
                                </FormDescription>
                              </div>
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Engagement Count - Only show when "With engagement" is selected */}
                  {engagement === "with_engagement" && (
                    <>
                      <Separator />

                      <div className="space-y-4 px-4">
                        <div>
                          <h3 className="text-sm font-medium">
                            Engagement count.
                          </h3>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            ↳ See posts from any time period.
                          </p>
                        </div>

                        {/* Likes */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Likes</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <Controller
                              control={form.control}
                              name="minLikes"
                              render={({ field }) => (
                                <div className="space-y-1">
                                  <Input
                                    size="sm"
                                    placeholder="1"
                                    disabled={isLoading}
                                    {...field}
                                  />
                                  <FormDescription className="ml-3 text-xs">
                                    ↳ Min likes.
                                  </FormDescription>
                                </div>
                              )}
                            />
                            <Controller
                              control={form.control}
                              name="maxLikes"
                              render={({ field }) => (
                                <div className="space-y-1">
                                  <Input
                                    size="sm"
                                    placeholder="e.g., 10000"
                                    disabled={isLoading}
                                    {...field}
                                  />
                                  <FormDescription className="ml-3 text-xs">
                                    ↳ Max likes.
                                  </FormDescription>
                                </div>
                              )}
                            />
                          </div>
                        </div>

                        {/* Replies */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Replies</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <Controller
                              control={form.control}
                              name="minReplies"
                              render={({ field }) => (
                                <div className="space-y-1">
                                  <Input
                                    size="sm"
                                    placeholder="1"
                                    disabled={isLoading}
                                    {...field}
                                  />
                                  <FormDescription className="ml-3 text-xs">
                                    ↳ Min replies.
                                  </FormDescription>
                                </div>
                              )}
                            />
                            <Controller
                              control={form.control}
                              name="maxReplies"
                              render={({ field }) => (
                                <div className="space-y-1">
                                  <Input
                                    size="sm"
                                    placeholder="e.g., 10000"
                                    disabled={isLoading}
                                    {...field}
                                  />
                                  <FormDescription className="ml-3 text-xs">
                                    ↳ Max replies.
                                  </FormDescription>
                                </div>
                              )}
                            />
                          </div>
                        </div>

                        {/* Retweets */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Retweets</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <Controller
                              control={form.control}
                              name="minRetweets"
                              render={({ field }) => (
                                <div className="space-y-1">
                                  <Input
                                    size="sm"
                                    placeholder="1"
                                    disabled={isLoading}
                                    {...field}
                                  />
                                  <FormDescription className="ml-3 text-xs">
                                    ↳ Min retweets.
                                  </FormDescription>
                                </div>
                              )}
                            />
                            <Controller
                              control={form.control}
                              name="maxRetweets"
                              render={({ field }) => (
                                <div className="space-y-1">
                                  <Input
                                    size="sm"
                                    placeholder="e.g., 10000"
                                    disabled={isLoading}
                                    {...field}
                                  />
                                  <FormDescription className="ml-3 text-xs">
                                    ↳ Max retweets.
                                  </FormDescription>
                                </div>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            </form>
          </Form>
        </ScrollArea>
      </Tabs>
    </div>
  );
});
