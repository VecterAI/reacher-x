/**
 * Reusable form field components to reduce duplication
 */

import React from "react";
import { Controller, Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "./Form";
import { Input } from "./Input";
import { Checkbox } from "./Checkbox";
import { RadioGroup, RadioGroupItem } from "./RadioGroup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { cn } from "@/shared/lib/utils/utils";

// Base form field props
interface BaseFormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

// Text input field
interface TextFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends BaseFormFieldProps<TFieldValues, TName> {
  placeholder?: string;
  size?: "sm" | "default" | "lg";
  type?: "text" | "email" | "password" | "url";
}

export function TextField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  className,
  size = "sm",
  type = "text",
}: TextFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel className="text-sm font-medium">{label}</FormLabel>
          <FormControl>
            <Input
              size={size}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              {...field}
            />
          </FormControl>
          {description && (
            <FormDescription className="ml-3 text-xs text-muted-foreground">
              ↳ {description}
            </FormDescription>
          )}
          {fieldState.error && (
            <FormMessage>{fieldState.error.message}</FormMessage>
          )}
        </FormItem>
      )}
    />
  );
}

// Checkbox field
interface CheckboxFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends BaseFormFieldProps<TFieldValues, TName> {
  layout?: "horizontal" | "vertical";
}

export function CheckboxField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  disabled,
  className,
  layout = "horizontal",
}: CheckboxFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem
          className={cn(
            layout === "horizontal"
              ? "flex flex-row items-start gap-3 space-y-0"
              : "space-y-2",
            className
          )}
        >
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <div
            className={layout === "horizontal" ? "grid gap-0.5" : "space-y-1"}
          >
            <FormLabel className="text-sm font-medium">{label}</FormLabel>
            {description && (
              <FormDescription className="text-xs">
                ↳ {description}
              </FormDescription>
            )}
            {fieldState.error && (
              <FormMessage>{fieldState.error.message}</FormMessage>
            )}
          </div>
        </FormItem>
      )}
    />
  );
}

// Select field
interface SelectFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends BaseFormFieldProps<TFieldValues, TName> {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  size?: "sm" | "default" | "lg";
}

export function SelectField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  options,
  placeholder,
  disabled,
  className,
  size = "sm",
}: SelectFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel className="text-sm font-medium">{label}</FormLabel>
          <FormControl>
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger size={size}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          {description && (
            <FormDescription className="ml-3 text-xs text-muted-foreground">
              ↳ {description}
            </FormDescription>
          )}
          {fieldState.error && (
            <FormMessage>{fieldState.error.message}</FormMessage>
          )}
        </FormItem>
      )}
    />
  );
}

// Radio group field
interface RadioFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends BaseFormFieldProps<TFieldValues, TName> {
  options: Array<{ value: string; label: string; description?: string }>;
  onValueChange?: (value: string) => void;
}

export function RadioField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  options,
  disabled,
  className,
  onValueChange,
}: RadioFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-sm font-medium">{label}</FormLabel>
          {description && (
            <FormDescription className="text-xs text-muted-foreground">
              ↳ {description}
            </FormDescription>
          )}
          <FormControl>
            <RadioGroup
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                onValueChange?.(value);
              }}
              disabled={disabled}
              className="gap-0.5"
            >
              {options.map((option) => (
                <div key={option.value} className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <FormLabel
                      htmlFor={option.value}
                      className="text-sm font-medium"
                      aria-describedby={
                        option.description ? `${option.value}-desc` : undefined
                      }
                    >
                      {option.label}
                    </FormLabel>
                  </div>
                  {option.description && (
                    <FormDescription
                      id={`${option.value}-desc`}
                      className="ml-6 text-xs"
                    >
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
  );
}
